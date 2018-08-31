(function(context, name, definition) {
  if (typeof define === 'function' && define.amd) {
    define(definition);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = definition();
  } else {
    context[name] = definition();
  }
})(this, 'SimplePromise', function() {
  function Promise (executor) {
    var self = this;
    self.status = 'pending';
    self.data = null;
    self.reason = null;
    self.resolveCallbacks = [];
    self.rejectCallbacks = [];

    function resolve(data) {
      if (self.status === 'pending') {
        setTimeout(function() {
          self.status = 'resolved';
          self.data = data;
          self.resolveCallbacks.forEach(cb => cb(data));
        });
      }
    }

    function reject(reason) {
      if (self.status === 'pending') {
        setTimeout(function() {
          self.status = 'rejected';
          self.reason = reason;
          self.rejectCallbacks.forEach(cb => cb(reason));
        });
      }
    }

    executor(resolve, reject);
  }

  Promise.prototype.then = function (onResolved, onRejected) {
    var self = this;
    var promise = null;

    onResolved = typeof onResolved === 'function' ? onResolved : function (value) { return value; }
    onRejected = typeof onRejected === 'function' ? onRejected : function (reason) { throw reason; }

    function resolvePromise(promise, x, resolve, reject) {
      if (promise === x) {
        return reject(new TypeError('Chaining cycle detected for promise!'));
      }

      if (x instanceof Promise) {

        if (x.status === 'pending') {
          x.then(function (value) {
            resolvePromise(promise, value, resolve, reject);
          }, reject);
        } else {
          x.then(resolve, reject);
        }
        return;
      }

      if ((x !== null && typeof x === 'object') || typeof x === 'function') {
        var thenCalled = false;

        try {
          var then = x.then;
          if (typeof then === 'function') {
            then.call(x, function (y) {
              if (thenCalled) return;
              thenCalled = true;
              return resolvePromise(promise, y, resolve, reject);
            }, function (r) {
              if (thenCalled) return;
              thenCalled = true;
              return reject(r);
            })
          } else {
            resolve(x);
          }
        } catch (e) {
          if (thenCalled) return;
          thenCalled = true;
          reject(e);
        }
      } else {
        resolve(x);
      }
    }

    function dealPromise(dealFunc, resolve, reject) {
      return function (data) {
        setTimeout(function() {
          try {
            var x = dealFunc(data);
            resolvePromise(promise, x, resolve, reject);
          } catch(err) {
            reject(err);
          }
        });
      }
    }

    if (self.status === 'resolved') {
      promise = new Promise((resolve, reject) => { dealPromise(onResolved, resolve, reject)(self.data); });
    }

    if (self.status === 'rejected') {
      promise = new Promise((resolve, reject) => { dealPromise(onRejected, resolve, reject)(self.reason); });
    }

    if (self.status === 'pending') {
      promise = new Promise(function (resolve, reject) {
        self.resolveCallbacks.push(dealPromise(onResolved, resolve, reject));

        self.rejectCallbacks.push(dealPromise(onRejected, resolve, reject));
      })
    }

    return promise;
  }

  Promise.resolve = function (data) {
    return new Promise(function (resolve) {
      resolve(data);
    });
  }

  Promise.reject = function (reason) {
    return new Promise((resolve, reject) => {
      reject(reason);
    });
  }

  Promise.race = function (promises) {
    return new Promise(function (resolve, reject) {
      var isHandled = false;
      promises.forEach(function (promise) {
        promise.then(function(value) {
          if (!isHandled) {
            resolve(value);
            isHandled = true;
          }
        }, reject);
      });
    });
  }

  Promise.all = function (promises) {
    return new Promise(function (resolve, reject) {
      var arr = []
      promises.forEach(function (promise) {
        promise.then(function (value) {
          arr.push(value);
          if (arr.length === promises.length) {
            resolve(arr);
          }
        }, reject);
      });
    })
  }

  Promise.deferred = function () {
    var global = {};

    var promise = new Promise(function (onResolve, onReject) {
      global.onResolve = onResolve;
      global.onReject = onReject;
    });

    var resolve = function (value) {
      global.onResolve(value);
    };

    var reject = function (reason) {
      global.onReject(reason);
    }

    return {
      promise,
      resolve,
      reject
    }
  }

  return Promise;
});
