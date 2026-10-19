const assert=require("node:assert/strict");
const dict=require("../extension/lexicon.js");
assert.ok(dict.count>=300,"Starter vocabulary should contain at least 300 words");
assert.match(dict.lookup("somewhere"),/어딘가/);
assert.equal(dict.lookup("unknown-external-word",{["unknown-external-word"]:"사용자 단어"}),"사용자 단어");
assert.equal(dict.lookup("playing",{play:"놀다"}),"놀다");
assert.equal(dict.lookup("__NO_SUCH_WORD__"),null);
assert.equal(dict.lookup("HAS"),"가지고 있다");
console.log("Offline English/Korean dictionary tests passed:",dict.count);
