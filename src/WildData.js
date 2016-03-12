var WildData = function(ref) {
    this.ref = ref;

}

WildData.prototype.onUserAdd = function(uid, callback) {
    ref.child('users').on('child_added', function(snap) {
        if (snap.key() != uid) {

            callback(snap.key());
        }
    });
};

WildData.prototype.onUserRemoved = function(uid, callback) {
    ref.child('users').on('child_removed', function(snap) {
        ref.child('users/' + uid + '/send/' + snap.key()).remove();
        ref.child('users/' + uid + '/receive/' + snap.key()).remove();
        callback(snap.key());
    });
};

// WildData.prototype.onUserState = function(callback) {
//     ref.child('userStates').on('child_changed', function(snap){
//      callback(snap.key());
//     });
// };

WildData.prototype.join = function(uid, callback) {
    ref.child('users/' + uid).onDisconnect().remove();
    ref.child('users/' + uid).update({ 'state': 'created' }, function(err) {
        if (err == null) {
            callback();
        } else {
            callback(err);
        }
    })
};

WildData.prototype.leave = function(uid) {
    ref.child('users').off('child_added');
    ref.child('users').off('child_removed');
    // ref.child('userStates').off('child_changed');
    ref.child('users/' + uid).remove();
    // ref.child('userStates/' + uid).remove();
}

module.exports = WildData;
