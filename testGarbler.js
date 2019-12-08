global.sodium = require('libsodium-wrappers');
global.fetch = require('node-fetch');
const { Garbler, bin2hex} = require('./src/jigg.js');



// application code
const circuitURL = 'circuits/sha256.txt';

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

/****
 * Create binary inputs for the concatenated PII and salt
 * test feature in test_token_2.py: 'D000S500M1900/01/01'
 * test salt in unit tests: SAMPLE_SALT
 * expected output hex: a8d66d9b0a85d05a308b8b08e9caa7c9d54d40103979c5b5bc6355a93600ed85
 */

const ascii2Binary = (asciiText) => {
    let binaryArray = ABC.toBinary(asciiText).split('').map((x) => { return Number(x) });
    return binaryArray
}

const binarySalt = ascii2Binary('SAMPLE_SALT');
const binaryInputPii = ascii2Binary('D000S500M1900/01/01');
const firstPadding = [1].concat(new Array(15).fill(0));

var input = binarySalt.concat(binaryInputPii).concat(firstPadding);

const progress = function (start, total) {
    console.log('Progress', start, '/', total);
};

const callback = function (results) {
    results = bin2hex(results);
    console.log('Results: ' + results);
    console.timeEnd('time');
};

const runGarbler = () => {
    var garbler = new Garbler(circuitURL, input, callback, progress, 0, 0);
    garbler.start();
}

console.time('time');
runGarbler()