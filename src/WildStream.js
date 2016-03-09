var WildStream = function(uId) {
    this.uId = uId;
    this.stream;
};

WildStream.prototype.getId = function() {
    return this.uId;
};

WildStream.prototype.setStream = function(stream) {
    this.stream = stream;
};

WildStream.prototype.bindToDOM = function(elementId) {
    var view = document.getElementById(elementId);
    view.src = URL.createObjectURL(this.stream);
}

module.exports = WildStream;
