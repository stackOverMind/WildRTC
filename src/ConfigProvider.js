var ConfigProvider = function(ref) {
    this.configuration = {};
};

ConfigProvider.prototype.getConfig = function(callback) {
    var token = ref.getAuth().token;
    console.log(token);
    var req = new XMLHttpRequest();

    req.open('GET', 'https://auth.wilddog.com/v1/webrtc/users/webrtc/secret?token=' + token, false);
    req.send(null);
    if (req.status == 200) {
        var message = JSON.parse(req.responseText);
        console.log(req.responseText);
        this.configuration = {};
        this.configuration.iceServers = message.iceServers;
        console.log("##############");
        console.log(this.configuration);
        callback(this.configuration);
    }
}

exports.ConfigProvider = ConfigProvider;