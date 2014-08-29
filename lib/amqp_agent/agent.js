require.paths.unshift(__dirname + '/node_modules');
util = require('util');
amqp = require('amqp');
dns = require('dns');
exec = require('child_process').exec;
log4js = require('log4js')();
smartdc_config = require('./lib/smartdc-config');

EventEmitter = require("events").EventEmitter;

inspect = util.inspect;

exports.timestamp = timestamp = function () { return (new Date).toISOString(); }

exports.AMQPAgent = AMQPAgent = function (config) {
  var self = this;
  EventEmitter.call(this);

  this.config = config || { amqp: {} };
  this.commandNames = ['ping'];

  self.initializeLogging();

  // Map the id's of incoming messages to the clients who sent them. This is
  // to avoid spamming all clients with ACKs they don't care about.
  this.messageIdToClientId = {};
  this._done = true;
  this._connected = false;
}

util.inherits(AMQPAgent, EventEmitter);

AMQPAgent.prototype.initializeLogging = function (callback) {
  this.log = {};
  this.createLogger('agent', 'AMQPAgent');
}

AMQPAgent.prototype.createLogger = function (name, category) {
  log4js.clearAppenders();
  var stdio = process.binding('stdio');
  var isatty = stdio.isatty(process.stdout.fd);
  log4js.addAppender
    ( log4js.consoleAppender
        ( isatty
          ? log4js.colouredLayout
          : log4js.basicLayout
        )
    );

  var logger = log4js.getLogger(category);
  this.log[name] = logger;
  return logger;
}

// Try to use /usr/bin/sysinfo and /lib/sdc/config.sh to determine AMQP
// credentials or fall back to ENV variables.
AMQPAgent.prototype.configureAMQP = function (callback) {
  var self = this;

  self.config.amqp = self.config.amqp || {};

  if (process.env['AMQP_USE_SYSTEM_CONFIG']) {
    smartdc_config.sysinfo(function (error, config) {
      self.sysinfo = config;
      var headnode = config['Boot Parameters'].headnode;

      // Look up and set the UUID of the machine the agent will run on.
      if (self.config.uuid || process.env['SERVER_UUID']) {
        self.uuid = self.config.uuid || process.env['SERVER_UUID'];
      }
      else {
        self.uuid = self.sysinfo['UUID'];
        if (!self.uuid) {
          throw new Error("Could not find 'UUID' in `sysinfo` output.");
        }
      }

      console.log("Using " + self.uuid + " as the server UUID");
      smartdc_config.sdcConfig(function (error, config) {
        self.sdcConfig = config;
        var rabbitmq = config['rabbitmq'].split(':');
        if (!rabbitmq) throw new Error("Could not find 'rabbitmq' parameter from /lib/sdc/config.sh");
        console.dir(rabbitmq);
        setAMQPConfig.apply(undefined, rabbitmq);
        callback();
      });
    });
  }
  else {
    if (self.config.uuid || process.env['SERVER_UUID']) {
      self.uuid = self.config.uuid || process.env['SERVER_UUID'];
    } else {
      throw new Error("Could not find server uuid in config[uuid] or ENV[SERVER_UUID]  ");
    }
    setAMQPConfig
      ( self.config.amqp.login    || process.env['AMQP_LOGIN']
      , self.config.amqp.password || process.env['AMQP_PASSWORD']
      , self.config.amqp.host     || process.env['AMQP_HOST']
      , self.config.amqp.port     || process.env['AMQP_PORT']
      , self.config.amqp.vhost    || process.env['AMQP_VHOST']
      );
    callback();
  }

  function setAMQPConfig(login, password, host, port, vhost) {
    self.config.amqp.login    = login      || 'guest';
    self.config.amqp.password = password   || 'guest';
    self.config.amqp.host     = host       || 'localhost';
    self.config.amqp.port     = port       || 5672;
    self.config.amqp.vhost    = vhost      || '/';
  }
}

AMQPAgent.prototype.connect = function(callback) {
  var self = this;
  self.connection = amqp.createConnection(self.config.amqp);
  self.addListeners(function () {
    self.setupQueue(function () {
      callback();
    });
  });
}

AMQPAgent.prototype.end = function () {
  this.connection.end();
}

AMQPAgent.prototype.addListeners = function (callback) {
  var self = this;

  this.connection.addListener('ready', function () {
    self.log.agent.info("Ready to receive commands");
    self._connected = true;
    self.exchange = self.connection.exchange('amq.topic', { type: 'topic' });

    var nopMsgInterval = setInterval(publishNOP, 30000);

    // Call callback on first connect, but not on reconnect.
    callback();

    function publishNOP() {
      if (!self._connected) {
        clearInterval(nopMsgInterval);
        return;
      }
      self.exchange.publish(self.resource + '._nop.' + self.uuid, {});
    }
  });

  this.connection.addListener('error', function (e) {
    self.log.agent.info("There was an AMQP error: " + e.message);
  });

  this.connection.addListener('close', function () {
    self._connected = false;
    if (self.config.reconnect) {
      self.log.agent.info('MQ connection severed. Waiting 5 seconds...');
      setTimeout(function () {
        self.log.agent.info('Connecting...');
        self.connection.reconnect();
      }, 5000);
    }
  });
}

//  Reply to client with an ACK message indicating command success
AMQPAgent.prototype.ackSuccess = function (id, data) {
  this._done = true;
  var msg = { req_id: id
            , timestamp: timestamp()
            };
  if (data && Object.keys(data).length) {
    for (key in data) {
      msg[key] = data[key];
    }
  }

  this.log.agent.info("Publishing success.")
  this.log.agent.debug(inspect(msg));
  this.exchange.publish
    ( this.config.resource
      + '.ack'
      + this.messageIdToClientId[id]
      + '.'
      + this.uuid
    , msg
    );

  if (!this.gracefulStop) {
    this.queue.shift();
  }
}

//  Reply to client with an ACK message indicating command error
AMQPAgent.prototype.ackError = function (id, error) {
  this._done = true;
  var msg = { req_id: id
            , timestamp: timestamp()
            , error: error };
  this.log.agent.info("Publishing error.");
  this.log.agent.debug(inspect(msg));
  this.exchange.publish
    ( this.config.resource
      + '.ack'
      + this.messageIdToClientId[id]
      + '.'
      + this.uuid
    , msg);

  if (!this.gracefulStop) {
    this.queue.shift();
  }
}

AMQPAgent.prototype.stopShifting = function () {
  if (this.config && this.config.reconnect)
    this.config.reconnect = false;
  this.gracefulStop = true;
}

AMQPAgent.prototype.isDone = function () {
  return this._done;
}

AMQPAgent.prototype.handleMessage = function(msg) {
  var self = this;
  if (!msg._routingKey) {
    this.log.agent.info('Error: message received without routingKey:\n' + inspect(msg));
    return;
  }

  var command = msg._routingKey.split('.')[1];
  self.log.agent.info("Message received:\n" + inspect(msg));

  if (this.commandNames.indexOf(command) === -1) {
    var errorMsg = 'Error: message received with invalid command, "'
                   + command + '"';
    return self.ackError(msg.id, errorMsg);
  }

  this.messageIdToClientId[msg.id] = msg.client_id;
  if (command === 'ping') {
    return self.ackSuccess(msg.id);
  }
  this._done = false;
  this.emit('command', command, msg);
}

AMQPAgent.prototype.registerCommand = function (command) {
  this.commandNames.push(command);
}

AMQPAgent.prototype.setupQueue = function(callback) {
  var self = this;
  var queueName = this.queueName = this.config.resource + '.' + this.uuid;
  this.queue = this.connection.queue(queueName);

  for (var i = 0, il = this.commandNames.length; i < il; i++) {
    self.queue.bind('amq.topic', this.config.resource + '.' + this.commandNames[i] + '.' + this.uuid);
  }
  this.queue.addListener('open', function (messageCount, consumerCount) {
    self.queue.subscribeJSON({ ack: true }, function (msg) {
      self.handleMessage(msg);
      // We will let ackError/ackSuccess do queue shifting
    });
  });

  callback();
}

