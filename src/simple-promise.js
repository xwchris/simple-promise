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
    // 为了方面后面函数调用，防止this被破坏
    var self = this;
    self.status = 'pending';
    self.value = null;
    self.reason = null;
    // resolve的回调队列
    self.resolveCbs = [];
    // reject的回调队列
    self.rejectCbs = [];

    // resolve的时候改变状态，保存好传入的值，并调用相应的回调队列
    function resolve(value) {
      if (self.status === 'pending') {
        // 由于promise需要异步执行，这里使用setTimeout来延迟执行
        setTimeout(function() {
          self.status = 'fulfilled';
          self.value = value;
          self.resolveCbs.forEach(function (cb) {
            cb(value);
          });
        });
      }
    }

    /// 与resolve相似，不过这里保存的是原因，改变状态为rejected
    function reject(reason) {
      if (self.status = 'pending') {
        setTimeout(function() {
          self.status = 'rejected';
          self.reason = reason;
          self.rejectCbs.forEach(function (cb) {
            cb(reason);
          });
        });
      }
    }

    executor(resolve, reject);
  }

  Promise.prototype.then = function (onResolved, onRejected) {
    var self = this;
    var promise = null;

    // onResolved是可选的，当其不存在或不是函数时，将其接受到的值一次往后透传
    onResolved = typeof onResolved === 'function' ? onResolved : function (value) { return value; };
    // onRejected是可选的，当其不存在或不是函数时，将其错误继续向后抛
    onRejected = typeof onRejected === 'function' ? onRejected : function (error) { throw error; };

    // 新的promise状态需要根据x的具体情况来确定
    function resolvePromise(promise, x, resolve, reject) {
      // 这一部分属于Promise/A+规范的Resolution Procedure部分

      // 2.3.1: 如果promise对象和x引用的是同一个对象，那么应该用一个TypeError的错误来reject掉promise
      // 如果两个对象是同一个对象，那么会无限循环调用，会出现错误
      if (promise === x) {
        return reject(new TypeError('Chaining cycle detected for promise!'));
      }

      // 2.3.2: 如果x是一个promise，应该用以下这些来决定它的状态
      if (x instanceof Promise) {
        // 2.3.2.1: 如果x是pending状态，那么promise必须是pending状态，直到x是fulfillded或rejected状态
        // 2.3.2.2: 如果x是fulfilled状态，那么promise需要用相同的值来resolve
        // 2.3.2.3: 如果x是rejected状态，那么promise需要用相同的原因来reject
        if (x.status === 'pending') {
          x.then(function(value) {
            // 由于x可能还是一个promise，所以这里递归调用
            resolvePromise(promise, value, resolve, reject);
          }, reject);
        } else {
          x.then(resolve, reject);
        }
        return;
      }

      // 2.3.3: 如果x是一个对象或者函数，这里是出里thenable的情况，thenable是指具有then函数的对象或函数
      // 2.3.4: 如果x既不是对象也不是函数，那么直接使用x来resolve promise
      if ((x !== null && typeof x === 'object') || typeof x === 'function') {
        var isCalled = false;

        try {
          // 2.3.3.1: 将x.then赋值为then
          var then = x.then;
          // 2.3.3.2: 如果检索到x.then的结果抛出了错误，那么直接reject掉
          // 2.3.3.3: 如果then是一个函数，那么用x作为this，第一个参数是resolvePromise，第二个参数是rejectPromise
          if (typeof then === 'function') {
            // 2.3.3.3.1: 如果resolvePromise被使用一个参数值y调用，执行[[Resolve]](promise, y)
            // 2.3.3.3.2: 如果rejectPromise被使用一个原因r调用，使用r来reject promise
            then.call(x, function (y) {
              // 2.3.3.3.3: 如果resolvePromise和rejectPromise同时被调用，或者这两个函数被使用相同的参数多次调用，那么只执行最开始的，其他的全部忽略
              if (isCalled) return;
              isCalled = true;
              return resolvePromise(promise, y, resolve, reject);
            }, function (r) {
              if (isCalled) return;
              isCalled = true;
              return reject(r);
            });
          } else {
            // 2.3.3.4: 如果then不是函数，用x来resolve promise
            resolve(x);
          }
        } catch(err) {
          // 2.3.3.3.4: 如果调用then的时候抛出错误
          // 2.3.3.3.4.1: 如果resolvePromise和rejectPromise已经被调用了，那么直接忽略掉
          // 2.3.3.3.4.2: 否则使用err来reject promise
          if (isCalled) return;
          isCalled = true;
          reject(err);
        }
      } else {
        resolve(x);
      }
    }

    function handlePromise(modifier, resolve, reject) {
      return function (value) {
        setTimeout(function() {
          try {
            var x = modifier(value);
            resolvePromise(promise, x, resolve, reject);
          } catch(err) {
            reject(err)
          }
        });
      }
    }

    if (self.status === 'fulfilled') {
      promise = new Promise(function (resolve, reject) {
        handlePromise(onResolved, resolve, reject)(self.value);
      });
    } else if (self.status === 'rejected') {
      promise = new Promise(function (resolve, reject) {
        handlePromise(onRejected, resolve, reject)(self.reason);
      });
    } else {
      promise = new Promise(function (resolve, reject) {
        self.resolveCbs.push(handlePromise(onResolved, resolve, reject));
        self.rejectCbs.push(handlePromise(onRejected, resolve, reject));
      });
    }

    return promise;
  }

  Promise.prototype.catch = function (onRejected) {
    return this.then(null, onRejected);
  }

  Promise.resolve = function (value) {
    return new Promise(function (resolve) {
      resolve(value);
    });
  }

  Promise.reject = function (reason) {
    return new Promise(function (_, reject) {
      reject(reason);
    });
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
      var length = promises.length;
      var count = 0;

      var cb = function(index, resolve, value) {
        if (value instanceof Promise) {
          value.then(function(newValue) {
            cb(index, resolve, newValue)
          });
          return;
        }

        arr[index] = value;

        count++;
        if (count === length) {
          resolve(arr);
        }
      }

      promises.forEach(function (promise, index) {
        promise.then(function (value) {
          cb(index, resolve, value);
        }, reject);
      });
    })
  }

  return Promise;
});
