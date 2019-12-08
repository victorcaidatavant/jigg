var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http, {
  pingTimeout: 25000,
  pingInterval: 50000
});
global.sodium = require('libsodium-wrappers');
global.fetch = require('node-fetch');
const { Garbler, bin2hex, hex2bin } = require('./src/jigg.js');  

app.use('/dist', express.static(__dirname + '/dist/'));
app.use('/circuits', express.static(__dirname + '/circuits/'));
app.get('/datavant', (request, response) => response.sendFile(__dirname + '/datavant_demo.html'));

app.post('/garbler_sha256', function (req, res) {
  // ABC - a generic, native JS (A)scii(B)inary(C)onverter.
  // (c) 2013 Stephan Schmitz <eyecatchup@gmail.com>
  // License: MIT, http://eyecatchup.mit-license.org
  // URL: https://gist.github.com/eyecatchup/6742657
  var ABC = {
    toAscii: function (bin) {
      return bin.replace(/\s*[01]{8}\s*/g, function (bin) {
        return String.fromCharCode(parseInt(bin, 2))
      })
    },
    toBinary: function (str, spaceSeparatedOctets) {
      return str.replace(/[\s\S]/g, function (str) {
        return ABC.zeroPad(str.charCodeAt().toString(2));
      })
    },
    zeroPad: function (num) {
      return "00000000".slice(String(num).length) + num
    }
  };

  const ascii2Binary = (asciiText) => {
    let binaryArray = ABC.toBinary(asciiText).split('').map((x) => { return Number(x) });
    return binaryArray
  }

  const binarySalt = ascii2Binary('SAMPLE_SALT');
  const binaryInputPii = ascii2Binary('D000S500M1900/01/01');
  const firstPadding = [1].concat(new Array(15).fill(0));

  const input = binarySalt.concat(binaryInputPii).concat(firstPadding);

  const progress = function (start, total) {
    console.log('Progress', start, '/', total);
  };

  const callback = function (results) {
    results = bin2hex(results);
    console.log('Results: ' + results);
  };

  const circuitURL = 'circuits/sha256.txt';
  var garbler = new Garbler(circuitURL, input, callback, progress, 0, 0);
  garbler.start();

  res.send('200 OK\n')
});


const port = (process.argv.length === 3)? process.argv[2] : 3000;
http.listen(port, () => console.log('listening on *:'+port));

var party = {garbler: null, evaluator: null};
var mailbox = {garbler: {}, evaluator: {}};
var cache = [];
io.on('connection', function (socket) {
  socket.on('join', function (msg) {
    if (msg === 'garbler' || (!(msg === 'evaluator') && party.garbler == null)) {
      party.garbler = socket.id;
      console.log('connect garbler');
      socket.emit('whoami', 'garbler');
      socket.on('disconnect', function() {
        party.garbler = null;
        mailbox.garbler = {};
        console.log('garbler disconnected');
      });
    } else if (msg === 'evaluator' || party.evaluator == null) {
      party.evaluator = socket.id;
      console.log('connect evaluator');
      socket.emit('whoami', 'evaluator');
      socket.on('disconnect', function() {
        party.evaluator = null;
        mailbox.evaluator = {};
        console.log('evaluator disconnected');
      });
    }
    if (party.garbler != null && party.evaluator != null) {
      console.log('Both parties connected.');
      io.to(party.garbler).emit('go');
      io.to(party.evaluator).emit('go');
    }


    if (msg === 'finish') {
      party.garbler = null;
      mailbox.garbler = {};
      console.log('garbler disconnected');
    }


  });

  socket.on('send', function(tag, msg) {
    console.log('send', tag, msg);
    if (socket.id === party.garbler) {
      if (typeof(mailbox.evaluator[tag]) !== 'undefined' && mailbox.evaluator[tag] != null) {
        mailbox.evaluator[tag](msg);
      } else {
        mailbox.evaluator[tag] = msg;
      }
    }
    if (socket.id === party.evaluator) {
      if (typeof(mailbox.garbler[tag]) !== 'undefined' && mailbox.garbler[tag] != null) {
        mailbox.garbler[tag](msg);
      } else {
        mailbox.garbler[tag] = msg;
      }
    }
  });

  socket.on('listening for', function(tag) {
    console.log('listening for', tag);
    if (socket.id === party.garbler) {
      if (typeof(mailbox.garbler[tag]) !== 'undefined' && mailbox.garbler[tag] != null) {
        const msg = mailbox.garbler[tag];
        console.log('sent', tag, msg, 'to garbler');
        io.to(party.garbler).emit(tag, msg);
        mailbox.garbler[tag] = null;
      } else {
        (new Promise(function(resolve, reject) {
          mailbox.garbler[tag] = resolve;
        })).then(function (msg) {
          console.log('sent', tag, msg, 'to garbler (as promised)');
          io.to(party.garbler).emit(tag, msg);
          mailbox.garbler[tag] = null;
        });
      }
    }
    if (socket.id === party.evaluator) {
      if (typeof(mailbox.evaluator[tag]) !== 'undefined' && mailbox.evaluator[tag] != null) {
        const msg = mailbox.evaluator[tag];
        console.log('sent', tag, msg, 'to evaluator');
        io.to(party.evaluator).emit(tag, msg);
        mailbox.evaluator[tag] = null;
      } else {
        (new Promise(function(resolve, reject) {
          mailbox.evaluator[tag] = resolve;
        })).then(function (msg) {
          console.log('sent', tag, msg, 'to evaluator (as promised)');
          io.to(party.evaluator).emit(tag, msg);
          mailbox.evaluator[tag] = null;
        });
      }
    }
  });

  socket.on('oblv', function(params) {
    console.log('oblv', params);
    const msg_id = params.msg_id;
    const length = params.length;

    var r0, r1;
    if (cache[msg_id] === undefined || cache[msg_id].unused) {
      if (cache[msg_id] === undefined) {
        cache[msg_id] = {unused: true};  // or with just {}
      }
      r0 = [];
      r1 = [];
      for (var i = 0; i < length; i++) {  // or with map(...)
        r0[i] = sodium.randombytes_uniform(256);
        r1[i] = sodium.randombytes_uniform(256);
      }
      cache[msg_id].r0 = r0;
      cache[msg_id].r1 = r1;
      cache[msg_id].unused = false;
    } else {
      r0 = cache[msg_id].r0;
      r1 = cache[msg_id].r1;
      cache[msg_id] = {unused: true};  // clear cache
    }

    if (socket.id === party.garbler) {
      socket.emit('oblv'+msg_id, JSON.stringify([r0, r1]));
    }

    if (socket.id === party.evaluator) {
      const d = sodium.randombytes_uniform(2);
      socket.emit('oblv'+msg_id, JSON.stringify([d, d ? r1 : r0]));
    }
  });
});

exports.close = function () {
  try {
    console.log('Closing server');
    io.to(party.garbler).emit('shutdown', 'finished');
    io.to(party.evaluator).emit('shutdown', 'finished');
    io.close();
    http.close();
    console.log('Server closed');
  } catch (e) {
    console.log('Closing with error', e);
  }
};
