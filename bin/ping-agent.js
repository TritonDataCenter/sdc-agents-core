#!/usr/node/bin/node

var util = require('util');
var path = require('path');

if (process.argv.length < 4) {
    console.log('Invalid number of command-line arguments:');
    console.log(
        ' ' + process.argv[0]
        + ' ' + process.argv[1]
    + ' <node-uuid> <agent-resource> <options>');
    process.exit(1);
}

var args = process.argv.slice(4);
var i = args.length;
var opts = {};
var kv;

while (i--) {
    kv = args[i].split('=');
    opts[kv[0]] = kv[1];
}

var timeout = opts.timeout || Number(opts.timeout);

var client = new (require('amqp_agent/client')).Client({ timeout: timeout });

client.connect(function () {
    console.log('Connected');

    client.getAgentHandle(process.argv[2], process.argv[3], function (handle) {
        handle.sendCommand('ping', {}, function (msg) {
            process.stdout.write(util.inspect(msg, false, 10));
            process.exit(0);
        });
    });
});
