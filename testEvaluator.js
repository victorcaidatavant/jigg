global.sodium = require('libsodium-wrappers');
global.fetch = require('node-fetch');
const { Evaluator, bin2hex } = require('./src/jigg.js');



// application code
const circuitURL = 'circuits/sha256.txt';

// setup bits 256-511 (0-indexed) for SHA256
// note: in SHA256 padding, the last 64 bits are used to indicate number of bits in input data to be hashed
const inputPart1 = new Array(248).fill(0);
const inputPart2 = [1, 1, 1, 1, 0, 0, 0, 0];
input = inputPart1.concat(inputPart2);

const progress = function (start, total) {
    console.log('Progress', start, '/', total);
};

const callback = function (results) {
    results = bin2hex(results);
    console.log('Results: ' + results);
    console.timeEnd('time');
};

const runEvaluator = () => {
    var evaluator = new Evaluator(circuitURL, input, callback, progress, 0, 0);
    evaluator.start();
}

console.time('time');
runEvaluator()
