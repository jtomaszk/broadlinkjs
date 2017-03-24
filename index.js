"use strict";

var util = require('util');
var EventEmitter = require('events');
var dgram = require('dgram');
var os = require('os');
var crypto = require('crypto');

var Broadlink = module.exports = function () {
    EventEmitter.call(this);
    this.devices = [];
};

util.inherits(Broadlink, EventEmitter);

Broadlink.prototype.genDevice = function (devtype, host, mac) {
    var dev;
    if (devtype == 0) { // SP1
        dev = new Device(host, mac);
        dev.sp1();
        return dev;
    } else if (devtype == 0x2711) { // SP2
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype == 0x2719 || devtype == 0x7919 || devtype == 0x271a || devtype == 0x791a) { // Honeywell SP2
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype == 0x2720) { // SPMini
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype == 0x753e) { // SP3
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype == 0x2728) { // SPMini2
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype == 0x2733 || devtype == 0x273e) { // OEM branded SPMini
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype >= 0x7530 && devtype <= 0x7918) { // OEM branded SPMini2
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype == 0x2736) { // SPMiniPlus
        dev = new Device(host, mac);
        dev.sp2();
        return dev;
    } else if (devtype == 0x2712) { // RM2
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x2737) { // RM Mini
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x273d) { // RM Pro Phicomm
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x2783) { // RM2 Home Plus
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x277c) { // RM2 Home Plus GDT
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x272a) { // RM2 Pro Plus
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x2787) { // RM2 Pro Plus2
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x278b) { // RM2 Pro Plus BL
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x278f) { // RM Mini Shate
        dev = new Device(host, mac);
        dev.rm();
        return dev;
    } else if (devtype == 0x2714) { // A1
        dev = new Device(host, mac);
        dev.a1();
        return dev;
    } else if (devtype == 0x4EB5) { // MP1
        dev = new Device(host, mac);
        dev.mp1();
        return dev;
    } else {
        dev = new Device(host, mac);
        dev.device();
        return dev;
    }
}

Broadlink.prototype.discover = function () {
    var self = this;
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address_i = interfaces[k][k2];
            if (address_i.family === 'IPv4' && !address_i.internal) {
                addresses.push(address_i.address);
            }
        }
    }
    var address = addresses[0].split('.');

    var cs = dgram.createSocket({type: 'udp4', reuseAddr: true});
    cs.on('listening', function () {
        cs.setBroadcast(true);

        var port = cs.address().port;
        var now = new Date();
        var starttime = now.getTime();

        var timezone = now.getTimezoneOffset() / -3600;
        var packet = Buffer.alloc(0x30, 0);

        var year = now.getYear();

        if (timezone < 0) {
            packet[0x08] = 0xff + timezone - 1;
            packet[0x09] = 0xff;
            packet[0x0a] = 0xff;
            packet[0x0b] = 0xff;
        } else {
            packet[0x08] = timezone;
            packet[0x09] = 0;
            packet[0x0a] = 0;
            packet[0x0b] = 0;
        }
        packet[0x0c] = year & 0xff;
        packet[0x0d] = year >> 8;
        packet[0x0e] = now.getMinutes();
        packet[0x0f] = now.getHours();
        var subyear = year % 100;
        packet[0x10] = subyear;
        packet[0x11] = now.getDay();
        packet[0x12] = now.getDate();
        packet[0x13] = now.getMonth();
        packet[0x18] = parseInt(address[0]);
        packet[0x19] = parseInt(address[1]);
        packet[0x1a] = parseInt(address[2]);
        packet[0x1b] = parseInt(address[3]);
        packet[0x1c] = port & 0xff;
        packet[0x1d] = port >> 8;
        packet[0x26] = 6;
        var checksum = 0xbeaf;

        for (var i = 0; i < packet.length; i++) {
            checksum += packet[i];
        }
        checksum = checksum & 0xffff;
        packet[0x20] = checksum & 0xff;
        packet[0x21] = checksum >> 8;
        cs.sendto(packet, 0, packet.length, 80, '255.255.255.255');
    });

    cs.on("message", function (msg, rinfo) {
        var host = rinfo;
        var mac = Buffer.alloc(6, 0);
        //mac = msg[0x3a:0x40];
        msg.copy(mac, 0, 0x34, 0x40);
        var devtype = msg[0x34] | msg[0x35] << 8;
        if (!self.devices) {
            self.devices = {};
        }

        if (!self.devices[mac]) {
            var dev = self.genDevice(devtype, host, mac);
            self.devices[mac] = dev;
            dev.on("deviceReady", function () {
                self.emit("deviceReady", dev);
            });
            dev.auth();
        }
    });

    cs.bind();
};

function Device(host, mac) {
    var self = this;
    self.host = host;
    self.mac = mac;
    self.emitter = new EventEmitter();

    self.on = self.emitter.on;
    self.emit = self.emitter.emit;

    self.timeout = 10;
    self.count = Math.random() & 0xffff;
    self.key = new Buffer([0x09, 0x76, 0x28, 0x34, 0x3f, 0xe9, 0x9e, 0x23, 0x76, 0x5c, 0x15, 0x13, 0xac, 0xcf, 0x8b, 0x02]);
    self.iv = new Buffer([0x56, 0x2e, 0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58]);
    self.id = new Buffer([0, 0, 0, 0]);
    self.cs = dgram.createSocket({type: 'udp4', reuseAddr: true});

    self.cs.on("message", function (response, rinfo) {
        var enc_payload = Buffer.alloc(response.length - 0x38, 0);
        response.copy(enc_payload, 0, 0x38);

        var decipher = crypto.createDecipheriv('aes-128-cbc', self.key, self.iv);
        decipher.setAutoPadding(false);
        var payload = decipher.update(enc_payload);
        var p2 = decipher.final();
        if (p2) {
            payload = Buffer.concat([payload, p2]);
        }
        if (!payload) {
            return false;
        }

        var command = response[0x26];
        var err = response[0x22] | (response[0x23] << 8);

        if (err != 0) return;

        if (command == 0xe9) {
            self.key = Buffer.alloc(0x10, 0);
            payload.copy(self.key, 0, 0x04, 0x14);

            self.id = Buffer.alloc(0x04, 0);
            payload.copy(self.id, 0, 0x00, 0x04);
            self.emit("deviceReady");
        } else if (command == 0xee) {
            self.emit("payload", err, payload);
        }
    });
    self.cs.bind();
    self.type = "Unknown";
}

Device.prototype.auth = function () {
    var payload = Buffer.alloc(0x50, 0);
    payload[0x04] = 0x31;
    payload[0x05] = 0x31;
    payload[0x06] = 0x31;
    payload[0x07] = 0x31;
    payload[0x08] = 0x31;
    payload[0x09] = 0x31;
    payload[0x0a] = 0x31;
    payload[0x0b] = 0x31;
    payload[0x0c] = 0x31;
    payload[0x0d] = 0x31;
    payload[0x0e] = 0x31;
    payload[0x0f] = 0x31;
    payload[0x10] = 0x31;
    payload[0x11] = 0x31;
    payload[0x12] = 0x31;
    payload[0x1e] = 0x01;
    payload[0x2d] = 0x01;
    payload[0x30] = 'T'.charCodeAt(0);
    payload[0x31] = 'e'.charCodeAt(0);
    payload[0x32] = 's'.charCodeAt(0);
    payload[0x33] = 't'.charCodeAt(0);
    payload[0x34] = ' '.charCodeAt(0);
    payload[0x35] = ' '.charCodeAt(0);
    payload[0x36] = '1'.charCodeAt(0);

    this.sendPacket(0x65, payload);
};

Device.prototype.getType = function () {
    return this.type;
};

Device.prototype.sendPacket = function (command, payload) {
    this.count = (this.count + 1) & 0xffff;
    var packet = Buffer.alloc(0x38, 0);
    packet[0x00] = 0x5a;
    packet[0x01] = 0xa5;
    packet[0x02] = 0xaa;
    packet[0x03] = 0x55;
    packet[0x04] = 0x5a;
    packet[0x05] = 0xa5;
    packet[0x06] = 0xaa;
    packet[0x07] = 0x55;
    packet[0x24] = 0x2a;
    packet[0x25] = 0x27;
    packet[0x26] = command;
    packet[0x28] = this.count & 0xff;
    packet[0x29] = this.count >> 8;
    packet[0x2a] = this.mac[0];
    packet[0x2b] = this.mac[1];
    packet[0x2c] = this.mac[2];
    packet[0x2d] = this.mac[3];
    packet[0x2e] = this.mac[4];
    packet[0x2f] = this.mac[5];
    packet[0x30] = this.id[0];
    packet[0x31] = this.id[1];
    packet[0x32] = this.id[2];
    packet[0x33] = this.id[3];

    var checksum = 0xbeaf;
    for (var i = 0; i < payload.length; i++) {
        checksum += payload[i];
        checksum = checksum & 0xffff;
    }

    var cipher = crypto.createCipheriv('aes-128-cbc', this.key, this.iv);
    payload = cipher.update(payload);
    var p2 = cipher.final();

    packet[0x34] = checksum & 0xff;
    packet[0x35] = checksum >> 8;

    packet = Buffer.concat([packet, payload]);

    checksum = 0xbeaf;
    for (var i = 0; i < packet.length; i++) {
        checksum += packet[i];
        checksum = checksum & 0xffff;
    }
    packet[0x20] = checksum & 0xff;
    packet[0x21] = checksum >> 8;

    this.cs.sendto(packet, 0, packet.length, this.host.port, this.host.address);
};

Device.prototype.mp1 = function () {
    this.type = "MP1";
    this.prototype.set_power_mask = function (sid_mask, state) {
        //"""Sets the power state of the smart power strip."""

        var packet = Buffer.alloc(16, 0);
        packet[0x00] = 0x0d;
        packet[0x02] = 0xa5;
        packet[0x03] = 0xa5;
        packet[0x04] = 0x5a;
        packet[0x05] = 0x5a;
        packet[0x06] = 0xb2 + (state ? (sid_mask << 1) : sid_mask);
        packet[0x07] = 0xc0;
        packet[0x08] = 0x02;
        packet[0x0a] = 0x03;
        packet[0x0d] = sid_mask;
        packet[0x0e] = state ? sid_mask : 0;

        this.sendPacket(0x6a, packet);
    }

    this.set_power = function (sid, state) {
        //"""Sets the power state of the smart power strip."""
        var sid_mask = 0x01 << (sid - 1);
        this.set_power_mask(sid_mask, state);
    }
    this.check_power_raw = function () {
        //"""Returns the power state of the smart power strip in raw format."""
        var packet = bytearray(16);
        packet[0x00] = 0x0a;
        packet[0x02] = 0xa5;
        packet[0x03] = 0xa5;
        packet[0x04] = 0x5a;
        packet[0x05] = 0x5a;
        packet[0x06] = 0xae;
        packet[0x07] = 0xc0;
        packet[0x08] = 0x01;

        this.sendPacket(0x6a, packet);
        /*
         err = response[0x22] | (response[0x23] << 8);
         if(err == 0){
         aes = AES.new(bytes(this.key), AES.MODE_CBC, bytes(self.iv));
         payload = aes.decrypt(bytes(response[0x38:]));
         if(type(payload[0x4]) == int){
         state = payload[0x0e];
         }else{
         state = ord(payload[0x0e]);
         }
         return state;
         }
         */
    }

    this.check_power = function () {
        //"""Returns the power state of the smart power strip."""
        /*
         state = this.check_power_raw();
         data = {};
         data['s1'] = bool(state & 0x01);
         data['s2'] = bool(state & 0x02);
         data['s3'] = bool(state & 0x04);
         data['s4'] = bool(state & 0x08);
         return data;
         */
    }


}


Device.prototype.sp1 = function () {
    this.type = "SP1";
    this.set_power = function (state) {
        var packet = Buffer.alloc(4, 4);
        packet[0] = state;
        this.sendPacket(0x66, packet);
    }
}


Device.prototype.sp2 = function () {
    this.type = "SP2";
    this.set_power = function (state) {
        //"""Sets the power state of the smart plug."""
        var packet = Buffer.alloc(16, 0);
        packet[0] = 2;
        packet[4] = state ? 1 : 0;
        this.sendPacket(0x6a, packet);
    }

    this.check_power = function () {
        //"""Returns the power state of the smart plug."""
        var packet = Buffer.alloc(16, 0);
        packet[0] = 1;
        this.sendPacket(0x6a, packet);
        /*
         err = response[0x22] | (response[0x23] << 8);
         if(err == 0){
         aes = AES.new(bytes(this.key), AES.MODE_CBC, bytes(self.iv));
         payload = aes.decrypt(bytes(response[0x38:]));
         return bool(payload[0x4]);
         }
         */
    }


}

Device.prototype.a1 = function () {
    var self = this;

    self.type = "A1";

    self.checkSensors = function () {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 1;
        self.sendPacket(0x6a, packet);
    };

    self.runCommand = function (command, args) {
        return self.checkSensors();
    };

    self.decodeLight = function (light) {
        switch (light) {
            case 0:
                return 'dark';
            case 1:
                return 'dim';
            case 2:
                return 'normal';
            case 3:
                return 'bright';
            default:
                return 'unknown';
        }
    };

    self.decodeAirQuality = function (light) {
        switch (light) {
            case 0:
                return 'excellent';
            case 1:
                return 'good';
            case 2:
                return 'normal';
            case 3:
                return 'bad';
            default:
                return 'unknown';
        }
    };

    self.decodeNoise = function (light) {
        switch (light) {
            case 0:
                return 'quiet';
            case 1:
                return 'normal';
            case 2:
                return 'noisy';
            default:
                return 'unknown';
        }
    };

    self.on("payload", function (err, payload) {
        var data = {};
        data['type'] = self.type;

        if (Number.isInteger(payload[0x4])) {
            data['temperature'] = (payload[0x4] * 10 + payload[0x5]) / 10.0;
            data['humidity'] = (payload[0x6] * 10 + payload[0x7]) / 10.0;
            data['light_raw'] = payload[0x8];
            data['air_quality_raw'] = payload[0x0a];
            data['noise_raw'] = payload[0xc];
        } else {
            data['temperature'] = (ord(payload[0x4]) * 10 + ord(payload[0x5])) / 10.0;
            data['humidity'] = (ord(payload[0x6]) * 10 + ord(payload[0x7])) / 10.0;
            data['light_raw'] = ord(payload[0x8]);
            data['air_quality_raw'] = ord(payload[0x0a]);
            data['noise_raw'] = ord(payload[0xc]);
        }

        data['light'] = self.decodeLight(data['light_raw']);
        data['air_quality'] = self.decodeAirQuality(data['air_quality_raw']);
        data['noise'] = self.decodeNoise(data['noise_raw']);

        self.emit("json", data);
    });
};

Device.prototype.rm = function () {
    var self = this;
    self.type = "RM2";
    self.checkIntervalId = null;

    self.setCheckInterval = function() {
        self.checkIntervalId = setInterval(function() {
            console.log('checkInterval');
            self.checkData();
        }, 1000);
    }
 
    self.clearCheckInterval = function(timeout) {
        if (self.checkIntervalId != null) {
            clearInterval(self.checkIntervalId);
            self.checkIntervalId = null;
            if (timeout) {
                var dataJSON = {};
                dataJSON['type'] = self.type;
                dataJSON["topic"] = "code-error";
                dataJSON["error"] = "timeout";
                self.emit("json", dataJSON);
            }
        }
    }
    self.runCommand = function (command, args) {
        switch (command) {
            case "send":
                return this.sendData(args);
            case "learn":
                return this.enterLearning();
            case "checkTemperature":
                return this.checkTemperature();
            case "checkData":
                return this.checkData();
        };
    };

    self.checkData = function () {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 4;
        self.sendPacket(0x6a, packet);
    };

    self.sendData = function (data) {
        var packet = new Buffer([0x02, 0x00, 0x00, 0x00]);
        packet = Buffer.concat([packet, new Buffer(data, 'base64')]);
        self.sendPacket(0x6a, packet);
    };

    self.enterLearning = function () {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 3;
        self.setCheckInterval();
        setTimeout(function() { 
            self.clearCheckInterval(true);
        }, 15000);
        self.sendPacket(0x6a, packet);
    };

    self.checkTemperature = function () {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 1;
        self.sendPacket(0x6a, packet);
    };

    self.on("payload", function (err, payload) {
        var param = payload[0];
        var dataJSON = {};
        dataJSON['type'] = self.type;
        dataJSON['param'] = param;

        switch (param) {
            case 1:  //response from checkTemperature
                var temp = (payload[0x4] * 10 + payload[0x5]) / 10.0;
                dataJSON["payload"] = temp;
                dataJSON["topic"] = "temperature";
                break;
            case 4: //response from checkData
                self.clearCheckInterval(false);
                var data = Buffer.alloc(payload.length - 4, 0);
                payload.copy(data, 0, 4);
                dataJSON["payload"] = data.toString('base64');
                dataJSON["topic"] = "code";
                break;
            case 2: //response from sendData
            case 3: //response from enterLearning
            default:
                dataJSON["payload"] = payload;
                dataJSON["topic"] = "raw";
                break;
        }

        self.emit("json", dataJSON);
    });
};

