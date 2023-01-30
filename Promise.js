class Promise {
  #PENDING = 'pengding';
  #FULFILLED = 'fulfilled';
  #REJECTED = 'rejected';
  #promiseState = this.#PENDING;

  #value = undefined;
  #reason = undefined;

  #resolveList = [];
  #rejectList = [];

  constructor(executor) {

    const reslove = value => {
      // 只有pengding状态才能被修改
      if (this.#promiseState === this.#PENDING) {
        this.#value = value;
        this.#promiseState = this.#FULFILLED;
        // 状态改变了，执行收集的依赖
        this.#resolveList.forEach(onFulFilled => onFulFilled(this.#value))
      }
    }

    const reject = reason => {
      if (this.#promiseState === this.#PENDING) {
        this.#reason = reason;
        this.#promiseState = this.#REJECTED;
        this.#rejectList.forEach(onRejected => onRejected(this.#reason))
      }
    }
    try {
      executor(reslove, reject);
    } catch (err) {
      reject(err);
    }
  }

  then(onFulFilled, onRejected) {

    onFulFilled = typeof onFulFilled === 'function' ? onFulFilled : value => value;
    onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason };

    // 生成微任务函数，默认走setTimeout
    let microtask = fn => { setTimeout(() => { fn() }) }
    if (queueMicrotask) {
      // node/deno/chrome/firefox支持queueMicrotask
      microtask = queueMicrotask;
    } else if (MutationObserver) {
      // 其余浏览器使用MutationObserver
      microtask = (fn) => {
        const node = document.createElement('div');
        const observer = new MutationObserver(function () {
          fn()
        })
        observer.observe(node, {
          childList: true,
        })
        node.innerHTML = 1;
      }
    }


    const promise = new Promise((reslove, reject) => {
      if (this.#promiseState === this.#FULFILLED) {
        microtask(() => {
          try {
            const x = onFulFilled(this.#value);
            resolvePromise(promise, x, reslove, reject)
          } catch (err) {
            reject(err);
          }
        })


      }

      if (this.#promiseState === this.#REJECTED) {
        microtask(() => {
          try {
            const x = onRejected(this.#reason);
            resolvePromise(promise, x, reslove, reject)
          } catch (err) {
            reject(err);
          }
        })

      }

      
      onFulFilled && this.#resolveList.push(value => {
        microtask(() => {
          try {
            const x = onFulFilled(value);
            resolvePromise(promise, x, reslove, reject)
          } catch (err) {
            reject(err);
          }
        })
      });

      onRejected && this.#rejectList.push(reason => {
        microtask(() => {
          try {
            const x = onRejected(reason);
            resolvePromise(promise, x, reslove, reject)
          } catch (err) {
            reject(err);
          }
        })

      });

    })
    return promise;
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(onFulFilled) {
    return this.then(onFulFilled, undefined)
  }

  static reslove(value) {
    return new Promise((resolve) => {
      resolve(value);
    })
  }

  static reject(reason) {
    return new Promise((_, reject) => {
      reject(reason);
    })
  }

  static all(promiseList = []) {
    return new Promise((resolve, reject) => {
      let count = 0;
      const result = [];
      promiseList.forEach((promise, index) => {
        promise.then(
          value => {
            result[index] = value;
            count += 1;
            if (count === promiseList.length) {
              resolve(result);
            }
          },
          reason => {
            reject(reason)
          }
        )
      })
    })
  }


  static race(promiseList = []) {
    return new Promise((resolve, reject) => {
      promiseList.forEach((promise) => {
        promise.then(
          value => {
            resolve(value);
          },
          reason => {
            reject(reason)
          }
        )
      })
    })
  }

}


function resolvePromise(promise, x, resolve, reject) {
  if (promise === x) {
    return reject(new TypeError('Chaining cycle detected for promise'))
  }
  // 防止多次调用
  let called;
  if (x !== null && (typeof x === 'function' || typeof x === 'object')) {
    try {
      const then = x.then;
      if (typeof then === 'function') {
        then.call(
          x,
          value => {
            if (called) return;
            called = true;
            // resolve的结果依旧是promise，递归解析
            resolvePromise(promise, value, resolve, reject);
          },
          reason => {
            if (called) return;
            called = true;
            reject(reason);
          }
        )
      } else {
        if (called) return;
        called = true;
        resolve(x);
      }
    } catch (err) {
      if (called) return;
      called = true;
      reject(err);
    }
  } else {
    resolve(x);
  }
}

// 单元测试使用
Promise.defer = Promise.deferred = function () {
  let dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
}

module.exports = Promise;
