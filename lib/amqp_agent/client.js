var amqp = require('amqp');
var exec = require('child_process').exec;
var util = require('util');

var inspect = util.inspect;

function timestamp() {
    return (new Date()).toISOString();
}


// generate random 4 byte hex strings
function genId() {
    return Math.floor(Math.random() * 0xffffffff).toString(16);
}


var Client = exports.Client = function (config) {
    this.config = config = config || { amqp: {} };
    this.commandTimeout = config.timeout || 5000;

    // AMQP credentials
    this.config.amqp = this.config.amqp || {};
    this.config.amqp.host = config.amqp.host || process.env['AMQP_HOST'] ||
        'localhost';
    this.config.amqp.login = config.amqp.login || process.env['AMQP_LOGIN'] ||
        'guest';
    this.config.amqp.password = config.amqp.password ||
        process.env['AMQP_PASSWORD'] || 'guest';
    this.config.amqp.vhost = config.amqp.vhost || process.env['AMQP_VHOST'] ||
        '/';

    this.config.reconnect = config.reconnect || false;
};


Client.prototype.useConnection = function (connection, callback) {
    var self = this;
    console.log('Reusing connection');
    self.agentHandles = {};
    self.connection = connection;
    self.exchange = self.connection.exchange('amq.topic', { type: 'topic' });
    self.exchange.addListener('open', function () {
        callback();
    });
};


Client.prototype.connect = function (callback) {
    var self = this;

    this.connection = amqp.createConnection(this.config.amqp);

    // Set up the exchange we'll be using to publish our commands. We wait for
    // the exchange to open and then run the callback.
    this.connection.addListener('ready', function () {
        self.agentHandles = {};
        self.exchange = self.connection.exchange(
            'amq.topic', { type: 'topic' });
        self.exchange.addListener('open', function () {
            callback();
        });
    });

    this.connection.addListener('error', function (e) {
        console.log('There was an AMQP error: ' + e.message);
    });

    this.connection.addListener('close', function () {
        console.log('MQ connection severed.');
        if (!self.config.reconnect) {
            return;
        }
        console.log('Waiting 5 seconds...');
        setTimeout(function () {
            console.log('Connecting...');
            self.connection.reconnect();
        }, 5000);
    });
};

Client.prototype.end = function () {
    this.config.reconnect = false;
    this.connection.end();
};

// The 'Client' object is decoupled from the creation and management of queues
// used to communicate with the agents. We will have the Client object hand us
// handles/closures/whatever that will deal with their own objects.
Client.prototype.getAgentHandle = function (uuid, resource, callback) {
    var handle;

    if (!this.agentHandles) {
        this.agentHandles = {};
    }

    if (this.agentHandles[uuid]) {
        handle = this.agentHandles[uuid];
    } else {
        handle = this.agentHandles[uuid]
            = new AgentHandle({
                connection: this.connection,
                exchange:   this.exchange,
                uuid:       uuid,
                timeout:    this.commandTimeout,
                resource:   resource
        });
    }

    handle.prepareAckQueue(function () {
        callback(handle);
    });
};


var AgentHandle = function (args) {
    this.uuid = args.uuid;
    this.connection = args.connection;
    this.exchange = args.exchange;
    this.ackCallbacks = undefined;
    this.clientId = genId();
    this.resource = args.resource;
    this.commandTimeout = args.timeout;
};


// Prepares the ACK queue that we'll be using to receive ACKs from this host's
// agent. We only need to do this once per host.
AgentHandle.prototype.prepareAckQueue = function (callback) {
    var self = this;
    // We're going to store the callback and timeouts for requests by their id
    // in this structure, so initialize it for this host if it hasn't been yet.
    if (!this.ackCallbacks) {
        this.ackCallbacks = {};
    } else {
        console.log('Queue has been set up already.');
        callback();
        return;
    }

    var queueName = this.resource + '.req.' + this.uuid + '.' + genId();
    console.log('Awaiting ACK on queue: ' + queueName);

    var queue = this.connection.queue(
        queueName, { autoDelete: true }, onqueue);

    function onqueue() {
        queue.bind('amq.topic',
            self.resource + '.ack' + self.clientId + '.' + self.uuid);
        queue.subscribeJSON(function (msg) {
            if (!msg.req_id) {
                console.log('Ack had no request id');
                return;
            }

            // abort if we have timed out waiting for an ACK response
            if (!self.ackCallbacks[msg.req_id]) {
                console.log('Didn\'t recognize request id ' +
                            'on ACK as originating from this client');
                return;
            }

            var cb = self.ackCallbacks[msg.req_id].callback;
            var timeout = self.ackCallbacks[msg.req_id].timeout;

            clearTimeout(timeout);
            delete self.ackCallbacks[msg.req_id];

            if (msg.error) {
                console.log('ACK indicated that an error occurred:');
                console.log(msg.error);
            }

            if (cb) cb(msg);
        });
        if (callback) {
            callback();
        }
    }
};


// Start expecting an ACK from the agent. Also set a timeout to fire an
// error if we wait for too long.
AgentHandle.prototype.listenForAck = function (id, callback) {
    var self = this;

    function onTimeout() {
        delete self.ackCallbacks[id];
        var msg = { error: 'Timed out waiting for response from agent '
            + 'after ' + self.commandTimeout + 'ms' };
            if (callback) callback(msg);
    }

    this.ackCallbacks[id] = {
        callback: callback,
        timeout: setTimeout(onTimeout, self.commandTimeout)
    };
};


// Send a command to the agent and call a callback on ACK/response
AgentHandle.prototype.sendCommand = function (commandName, payload, callback) {
    var self = this;
    var routingKey = this.resource + '.' + commandName + '.' + self.uuid;
    console.log('Publishing message to routing key: \'' + routingKey + '\'');

    payload.timestamp = timestamp();
    payload.client_id = this.clientId;
    var id = payload.id = genId();

    // Listen for an ACK in reply to message with `id` from this uuid
    // and set a timeout
    self.exchange.publish(routingKey, payload);
    self.listenForAck(id, callback);
    console.log('MSG: ' + inspect(payload));
};
