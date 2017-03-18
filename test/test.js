'use strict';
var Broadlink = require("broadlinkjs");
var fs = require('fs');
var b = new Broadlink();
b.on("deviceReady", function (dev) {
    if (dev.getType() !== 'RM2') {
        console.log('Not a supported device yet.');
    }
    var rm2 = dev;
    var timer = setInterval(function () {
        console.log("send check!");
        rm2.checkData();
    }, 1000);
    rm2.on("temperature", function (temp) {
        console.log("get temp " + temp);
        rm2.enterLearning();
    });
    rm2.on("rawData", function (data) {
        fs.writeFile("test1", data, function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file was saved!");
            clearInterval(timer);
        });
    });
    rm2.checkTemperature();
});
b.discover();
