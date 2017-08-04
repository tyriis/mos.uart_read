
ad('api_config.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_net.js');
load('api_sys.js');
load('api_timer.js');
load('api_http.js');
load('api_log.js');
load("api_uart.js");

let once = true;
let topic = 'mos/test';
let uartNo = 0;

let getInfo = function() {
  return JSON.stringify({total_ram: Sys.total_ram(), free_ram: Sys.free_ram(), id: Cfg.get('device.id'), uptime: Sys.uptime()});
};

let getTime = function() {
  HTTP.query({
    url: 'http://silver:8081',
    success: function(body, full_http_msg) {
      let obj = JSON.parse(body);
      MQTT.pub(topic, JSON.stringify(obj));
      MQTT.pub(topic, body);
    },
    error: function(err) { print(err); },  // Optional
  });
};

// Monitor network connectivity.
Net.setStatusEventHandler(function(ev, arg) {
  let evs = "???";
  if (ev === Net.STATUS_DISCONNECTED) {
    evs = "DISCONNECTED";
    once = true;
  } else if (ev === Net.STATUS_CONNECTING) {
    evs = "CONNECTING";
  } else if (ev === Net.STATUS_CONNECTED) {
    evs = "CONNECTED";
  } else if (ev === Net.STATUS_GOT_IP) {
    evs = "GOT_IP";
    getTime();
  }
  print("== Net event:", ev, evs);
}, null);


MQTT.setEventHandler(function(conn, ev, edata) {
  if (once && ev === 202 /* MQTT CONNACK*/) {
    once = false;
    MQTT.pub(topic, getInfo(), 1);
  }
}, null);

UART.setConfig(uartNo, {
  baudRate: 115200,
  esp8266: {
    rx: 3,
    tx: 1
  },
});

UART.setRxEnabled(uartNo, true);
UART.setDispatcher(uartNo, function(uartNo, ud) {
  let ra = UART.readAvail(uartNo);
  if (ra > 0) {
    let data = UART.read(uartNo);
    if (data) {
      MQTT.pub(topic, data.slice(0, -2), 1);
    }
  }
}, null);

MQTT.sub(topic, function(conn, topic, msg) {
  print('Topic:', topic, 'message:', msg);
  if (msg === 'led_on') {
    let value = GPIO.toggle(led);
  } else if (msg[0] === '/') {
    UART.write(uartNo, msg + "\r\n");
  } else if (msg === 'time') {
    print(msg);
    getTime();
    Log.info('test');
  }
}, null);

