#include <Arduino.h>
#include <WiFi.h>
#include <esp_http_server.h>
#include <atomic>
#include <cstring>
#include "beacon.h"
#if __has_include("config.local.h")
#include "config.local.h"
#else
#include "config.example.h"
#endif

static_assert(BEACON_MAX_DUTY >= 1 && BEACON_MAX_DUTY <= 255, "PWM ceiling must be 1..255");
static_assert(!BEACON_LED_ENABLED ||
              (beacon::allowedPin(BEACON_RED_PIN) && beacon::allowedPin(BEACON_GREEN_PIN) &&
               beacon::allowedPin(BEACON_BLUE_PIN) && BEACON_RED_PIN != BEACON_GREEN_PIN &&
               BEACON_RED_PIN != BEACON_BLUE_PIN && BEACON_GREEN_PIN != BEACON_BLUE_PIN),
              "Choose three distinct permitted GPIOs after checking the board");

// HTTP runs in an ESP-IDF task; only this atomic mailbox crosses into loop().
// Latest preset wins. PWM hardware is touched only by loop()/setup().
std::atomic<beacon::State> desired{beacon::State::Unknown};
beacon::Display display;
httpd_handle_t server = nullptr;
bool ledReady = false;
bool wasConnected = false;
uint32_t lastReconnect = 0;
uint32_t lastFrame = 0;
uint32_t lastHttpAttempt = 0;

esp_err_t reply(httpd_req_t* req, const char* status, const char* body) {
  httpd_resp_set_status(req, status);
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  return httpd_resp_send(req, body, HTTPD_RESP_USE_STRLEN);
}
esp_err_t preset(httpd_req_t* req) {
  // Check the declared length BEFORE reading or allocating the body.
  if (req->content_len == 0 || req->content_len > 64) {
    httpd_resp_set_hdr(req, "Connection", "close");
    reply(req, "413 Payload Too Large", "{\"error\":\"body_size\"}");
    return ESP_FAIL; // close so unread bytes cannot become a second request
  }
  char type[64] = {};
  if (httpd_req_get_hdr_value_str(req, "Content-Type", type, sizeof(type)) != ESP_OK ||
      (strcmp(type, "application/json") != 0 && strcmp(type, "application/json; charset=utf-8") != 0)) {
    httpd_resp_set_hdr(req, "Connection", "close");
    reply(req, "415 Unsupported Media Type", "{\"error\":\"content_type\"}");
    return ESP_FAIL;
  }
  char body[64];
  size_t received = 0;
  while (received < req->content_len) {
    const int n = httpd_req_recv(req, body + received, req->content_len - received);
    if (n <= 0) return ESP_FAIL; // incomplete / timed-out bodies never update state
    received += static_cast<size_t>(n);
  }
  beacon::State next;
  if (!beacon::parsePreset(body, received, next))
    return reply(req, "422 Unprocessable Entity", "{\"error\":\"invalid_preset\"}");
  desired.store(next);
  return reply(req, "200 OK", "{\"success\":true}");
}
esp_err_t health(httpd_req_t* req) {
  char body[160];
  snprintf(body, sizeof(body),
           "{\"device\":\"agentbeacon-rgb\",\"desired_state\":\"%s\",\"led_enabled\":%s}",
           beacon::name(desired.load()), ledReady ? "true" : "false");
  return reply(req, "200 OK", body);
}
void startHttp() {
  if (server) return;
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.max_open_sockets = 2;
  config.lru_purge_enable = true;
  config.recv_wait_timeout = 1;
  config.send_wait_timeout = 1;
  if (httpd_start(&server, &config) != ESP_OK) { server = nullptr; return; }
  httpd_uri_t stateRoute = {};
  stateRoute.uri = "/json/state"; stateRoute.method = HTTP_POST; stateRoute.handler = preset;
  httpd_uri_t healthRoute = {};
  healthRoute.uri = "/health"; healthRoute.method = HTTP_GET; healthRoute.handler = health;
  if (httpd_register_uri_handler(server, &stateRoute) != ESP_OK ||
      httpd_register_uri_handler(server, &healthRoute) != ESP_OK) {
    httpd_stop(server); server = nullptr;
  }
}
void setup() {
  Serial.begin(115200);
  if (BEACON_LED_ENABLED) {
    const int pins[] = {BEACON_RED_PIN, BEACON_GREEN_PIN, BEACON_BLUE_PIN};
    ledReady = true;
    for (int channel = 0; channel < 3; ++channel) {
      if (ledcSetup(channel, 5000, 8) == 0) ledReady = false;
      ledcWrite(channel, beacon::pwm(0, BEACON_COMMON_ANODE));
    }
    if (ledReady) for (int c = 0; c < 3; ++c) ledcAttachPin(pins[c], c);
  }
  Serial.printf("AgentBeacon RGB: GPIO output %s\n", ledReady ? "enabled" : "disabled");
  // RAM-only Wi-Fi settings; no AP, provisioning portal, OTA or password logging.
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (strlen(BEACON_WIFI_SSID)) WiFi.begin(BEACON_WIFI_SSID, BEACON_WIFI_PASSWORD);
  else Serial.println("Set hotspot credentials in config.local.h before device testing.");
}
void loop() {
  const uint32_t now = millis();
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected && !wasConnected) {
    Serial.printf("Wi-Fi connected; device IP=%s\n", WiFi.localIP().toString().c_str());
  }
  if (!connected && wasConnected) Serial.println("Wi-Fi disconnected; displaying unknown");
  wasConnected = connected;
  if (!connected && strlen(BEACON_WIFI_SSID) && uint32_t(now - lastReconnect) >= 10000) {
    lastReconnect = now; WiFi.reconnect();
  }
  // HTTP is available only via the STA network; no softAP is created.
  if (connected && !server && uint32_t(now - lastHttpAttempt) >= 1000) {
    lastHttpAttempt = now; startHttp();
  }
  const auto before = display.state;
  display.update(desired.load(), connected, now);
  if (display.state != before) Serial.printf("state=%s\n", beacon::name(display.state));
  if (uint32_t(now - lastFrame) >= 10) {
    lastFrame = now;
    const auto rgb = beacon::color(display.state, uint32_t(now - display.since), BEACON_MAX_DUTY);
    if (ledReady) {
      ledcWrite(0, beacon::pwm(rgb.red, BEACON_COMMON_ANODE));
      ledcWrite(1, beacon::pwm(rgb.green, BEACON_COMMON_ANODE));
      ledcWrite(2, beacon::pwm(rgb.blue, BEACON_COMMON_ANODE));
    }
  }
  delay(1); // yield to Wi-Fi tasks; animations never sleep for a whole flash period
}
