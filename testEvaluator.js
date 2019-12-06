global.sodium = require('libsodium-wrappers');
global.fetch = require('node-fetch');
const { Evaluator, bin2hex } = require('./src/jigg.js');



// application code
const circuitURL = 'circuits/sha256.txt';

var input = []
for (let i = 0; i < 256-64; i++) {
    input[i] = 0;
}

var array56 = []
for (let i = 0; i<56; i++) {array56[i]=0};
const end_padding_block = array56.concat([1,1,1,1,0,0,0,0])

input = input.concat(end_padding_block)

console.log('input: ', input)

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
