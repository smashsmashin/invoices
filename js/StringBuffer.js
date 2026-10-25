class StringBuffer {
    // constructor() {
    //     this.__strings__ = new Array;
    // }
    // append(str) {
    //     this.__strings__.push(str);
    //     return this;
    // }
    // insert(pos,str) {
    //     this.__strings__.splice(pos, 0, str);
    //     return this;
    // }
    // length() {
    //     return this.__strings__.join("").length;
    // }
    // toString() {
    //     return this.__strings__.join("");
    // }
    constructor() {
        this.__string__ = new String;
    }
    append(str) {
        this.__string__ = this.__string__.concat(str);
        return this;
    }
    insert(pos,str) {
        this.__string__ = this.__string__.slice(0, pos) + str + this.__string__.slice(pos);
        return this;
    }
    length() {
        return this.__string__.length;
    }
    toString() {
        return this.__string__;
    }
}