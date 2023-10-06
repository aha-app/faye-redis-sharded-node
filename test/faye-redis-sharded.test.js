// import {describe, expect, test} from '@jest/globals';

const { afterEach } = require('@jest/globals');

let _inboxes;
let _clients;
let engine;
let server;

var EngineSteps = {
  disconnect_engine: function() {
    this.engine.disconnect()
  },

  create_client: async function(name) {
    inboxes = _inboxes = _inboxes || {}
    clients = _clients = _clients || {}
    return new Promise((resolve, reject) => {
      engine.createClient(function(clientId) {
        clients[name] = clientId
        inboxes[name] = inboxes[name] || []
        resolve(clientId)
      })
    })
  },

  connect: async function(name, engine) {
    var clientId = _clients[name]
    var inboxes  = _inboxes
    return new Promise((resolve, reject) => {
      engine.connect(clientId, {}, function(messages) {
        for (var i = 0, n = messages.length; i < n; i++) {
          delete messages[i].id
          inboxes[name].push(messages[i])
        }
        resolve()
      })
    });
  },

  destroy_client: async function(name) {
    return new Promise((resolve, reject) => {
      this.engine.destroyClient(_clients[name], resolve)
    });
  },

  check_client_id: function(name, pattern) {
    expect(_clients[name]).toMatch(pattern)
  },

  check_num_clients: function(n) {
    var ids = new Set()
    for (var key in _clients) ids.add(_clients[key])
    expect(ids.count()).toBe(n)
  },

  check_client_exists: async function(name, exists) {
    var tc = this
    return new Promise((resolve, reject) => {
      tc.engine.clientExists(tc._clients[name], function(actual) {
        expect(actual).toBe(exists);
        resolve()
      })
    });
  },

  subscribe: async function(name, channel) {
    return new Promise((resolve, reject) => {
      this.engine.subscribe(_clients[name], channel, resolve)
    });
  },

  unsubscribe: async function(name, channel) {
    return new Promise((resolve, reject) => {
      this.engine.unsubscribe(_clients[name], channel, resolve)
    });
  },

  publish: function(messages) {
    messages = [].concat(messages)
    for (var i = 0, n = messages.length; i < n; i++) {
      var message = assign({ id: random() }, messages[i])
      this.engine.publish(message)
    }
  },

  publish_by: function(name, message) {
    message = assign({ clientId: _clients[name], id: random() }, message)
    this.engine.publish(message)
  },

  ping: function(name) {
    this.engine.ping(_clients[name])
  },

  // I'm just porting from the original library here, don't @ me
  clock_tick: async function(time) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, time)
    });
  },


  expect_non_exclusive_event: function(name, event, args, engine, callback) {
    var params  = [_clients[name]].concat(args),
        handler = jest.fn();

    // we don't care if the event is called for other clients
    var filter = function() {
      if (arguments[0] == params[0]) {
        handler.apply(undefined, Array.prototype.slice.call(arguments));
      }
    };

    engine.bind(event, filter)

    callback();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(params);
  },

  expect_event: function(name, event, args, resume, callback) {
    var params  = [_clients[name]].concat(args),
        handler = jest.fn();

    this.engine.bind(event, handler)

    callback();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(params);
  },

  expect_no_event: function(event, callback) {
    const handler = jest.fn();
    this.engine.bind(event, handler)
    callback();
    expect(handler).toHaveBeenCalledTimes(0);
  },

  expect_message: function(name, messages) {
    expect(_inboxes[name]).toEqual(messages)
  },

  expect_no_message: function(name) {
    expect(_inboxes[name]).toEqual([])
  },

  check_different_messages: function(a, b) {
    expect(_inboxes[a][0]).not.toEqual(_inboxes[b][0])
  }
}

describe("Pub/sub engines", () => {
  describe("faye engine", () => {
    beforeEach(() => {
      { Engine = require('../lib/faye-redis-sharded') }

      _inboxes = {}
      _clients = {}

      server = {
        generateId: () => { return require('crypto').randomBytes(32).toString('hex'); },
        timeout: 1,
        debug: (...args) => { console.debug(...args) },
        error: (...args) => { console.error(...args) },
        bind: jest.fn(),
        deliver: jest.fn(),
        trigger: jest.fn(),
        hasConnection: jest.fn(),
      }

      engine = new Engine(
        server,
        {
        timeout: 1,
        shards: [
          {
            url: "redis://localhost:6379/0",
            shardName: "shard0",
          },
          {
            url: "redis://localhost:6379/1",
            shardName: "shard1",
          },
        ]
      });
      Promise.all([
        EngineSteps.create_client("alice"),
        EngineSteps.create_client("bob"),
        EngineSteps.create_client("carol")
      ]);
    });

    afterEach(() => {
      engine.disconnect();
    });

    describe("createClient", () => {
      test("returns a client id", async () => {
        const clientId = await EngineSteps.create_client("dave");
        expect(clientId).toMatch(/^[a-z0-9]+$/);
      });
    });
  })
});

//       it("returns a different id every time", function() { with(this) {
//         $R(1,7).forEach(function(i) { create_client("client" + i) })
//         check_num_clients(10)
//       }})

//       it("publishes an event", function() { with(this) {
//         expect(engine, "trigger").given("handshake", match(/^[a-z0-9]+$/))
//         create_client("dave")
//       }})

//       describe("gc", function() { with(this) {
//         define("options", function() { return { timeout: 0.3, gc: 0.2 } })

//         it("doesn't prematurely remove a client after creation", function() { with(this) {
//           clock_tick(250)
//           check_client_exists("alice", true)
//         }})
//       }})
//     }})

//     describe("clientExists", function() { with(this) {
//       it("returns true if the client id exists", function() { with(this) {
//         check_client_exists("alice", true)
//       }})

//       it("returns false if the client id does not exist", function() { with(this) {
//         check_client_exists("anything", false)
//       }})
//     }})

//     describe("ping", function() { with(this) {
//       define("options", function() { return { timeout: 0.3, gc: 0.08 } })

//       it("removes a client if it does not ping often enough", function() { with(this) {
//         clock_tick(700)
//         check_client_exists("alice", false)
//       }})

//       it("prolongs the life of a client", function() { with(this) {
//         clock_tick(450)
//         ping("alice")
//         clock_tick(450)
//         check_client_exists("alice", true)
//         clock_tick(450)
//         check_client_exists("alice", false)
//       }})
//     }})

//     describe("destroyClient", function() { with(this) {
//       it("removes the given client", function() { with(this) {
//         destroy_client("alice")
//         check_client_exists("alice", false)
//       }})

//       it("publishes an event", function() { with(this) {
//         expect_event("alice", "disconnect", [])
//         destroy_client("alice")
//       }})

//       describe("when the client has subscriptions", function() { with(this) {
//         before(function() { with(this) {
//           this.message = { "channel": "/messages/foo", "data": "ok" }
//           subscribe("alice", "/messages/foo")
//         }})

//         it("stops the client receiving messages", function() { with(this) {
//           connect("alice", engine)
//           destroy_client("alice")
//           publish(message)
//           expect_no_message("alice")
//         }})

//         it("publishes an event", function() { with(this) {
//           expect_event("alice", "disconnect", [])
//           destroy_client("alice")
//         }})
//       }})
//     }})

//     describe("subscribe", function() { with(this) {
//       it("publishes an event", function() { with(this) {
//         expect_event("alice", "subscribe", ["/messages/foo"])
//         subscribe("alice", "/messages/foo")
//       }})

//       describe("when the client is subscribed to the channel", function() { with(this) {
//         before(function() { this.subscribe("alice", "/messages/foo") })

//         it("does not publish an event", function() { with(this) {
//           expect_no_event("alice", "subscribe", ["/messages/foo"])
//           subscribe("alice", "/messages/foo")
//         }})
//       }})
//     }})


//     describe("unsubscribe", function() { with(this) {
//       before(function() { this.subscribe("alice", "/messages/bar") })

//       it("does not publish an event", function() { with(this) {
//         expect_no_event("alice", "unsubscribe", ["/messages/foo"])
//         unsubscribe("alice", "/messages/foo")
//       }})

//       describe("when the client is subscribed to the channel", function() { with(this) {
//         before(function() { this.subscribe("alice", "/messages/foo") })

//         it("publishes an event", function() { with(this) {
//           expect_event("alice", "unsubscribe", ["/messages/foo"])
//           unsubscribe("alice", "/messages/foo")
//         }})
//       }})
//     }})

//     describe("publish", function() { with(this) {
//       before(function() { with(this) {
//         this.message = { "channel": "/messages/foo", "data": "ok", "blank": null }
//         connect("alice", engine)
//         connect("bob", engine)
//         connect("carol", engine)
//       }})

//       describe("with no subscriptions", function() { with(this) {
//         it("delivers no messages", function() { with(this) {
//           publish(message)
//           expect_no_message("alice")
//           expect_no_message("bob")
//           expect_no_message("carol")
//         }})

//         it("publishes a :publish event with a clientId", function() { with(this) {
//           expect_event("bob", "publish", ["/messages/foo", "ok"])
//           publish_by("bob", message)
//         }})

//         it("publishes a :publish event with no clientId", function() { with(this) {
//           expect_event(null, "publish", ["/messages/foo", "ok"])
//           publish(message)
//         }})
//       }})

//       describe("with a subscriber", function() { with(this) {
//         before(function() { with(this) {
//           subscribe("alice", "/messages/foo")
//         }})

//         it("delivers multibyte messages correctly", function() { with(this) {
//           message.data = "Apple = "
//           publish(message)
//           expect_message("alice", [message])
//         }})

//         it("delivers messages to the subscribed client", function() { with(this) {
//           publish(message)
//           expect_message("alice", [message])
//         }})

//         it("publishes a :publish event with a clientId", function() { with(this) {
//           expect_event("bob", "publish", ["/messages/foo", "ok"])
//           publish_by("bob", message)
//         }})
//       }})

//       describe("with a subscriber that is removed", function() { with(this) {
//         before(function() { with(this) {
//           subscribe("alice", "/messages/foo")
//           unsubscribe("alice", "/messages/foo")
//         }})

//         it("does not deliver messages to unsubscribed clients", function() { with(this) {
//           publish(message)
//           expect_no_message("alice")
//           expect_no_message("bob")
//           expect_no_message("carol")
//         }})

//         it("publishes a :publish event with a clientId", function() { with(this) {
//           expect_event("bob", "publish", ["/messages/foo", "ok"])
//           publish_by("bob", message)
//         }})
//       }})

//       describe("with multiple subscribers", function() { with(this) {
//         before(function() { with(this) {
//           subscribe("alice", "/messages/foo")
//           subscribe("bob",   "/messages/bar")
//           subscribe("carol", "/messages/foo")
//         }})

//         it("delivers messages to the subscribed clients", function() { with(this) {
//           publish(message)
//           expect_message("alice", [message])
//           expect_no_message("bob")
//           expect_message("carol", [message])
//         }})
//       }})

//       describe("with a single wildcard", function() { with(this) {
//         before(function() { with(this) {
//           subscribe("alice", "/messages/*")
//           subscribe("bob",   "/messages/bar")
//           subscribe("carol", "/*")
//         }})

//         it("delivers messages to matching subscriptions", function() { with(this) {
//           publish(message)
//           expect_message("alice", [message])
//           expect_no_message("bob")
//           expect_no_message("carol")
//         }})
//       }})

//       describe("with a double wildcard", function() { with(this) {
//         before(function() { with(this) {
//           subscribe("alice", "/messages/**")
//           subscribe("bob",   "/messages/bar")
//           subscribe("carol", "/**")
//         }})

//         it("delivers messages to matching subscriptions", function() { with(this) {
//           publish(message)
//           expect_message("alice", [message])
//           expect_no_message("bob")
//           expect_message("carol", [message])
//         }})

//         it("delivers a unique copy of the message to each client", function() { with(this) {
//           publish(message)
//           check_different_messages("alice", "carol")
//         }})
//       }})

//       describe("with multiple matching subscriptions for the same client", function() { with(this) {
//         before(function() { with(this) {
//           subscribe("alice", "/messages/*")
//           subscribe("alice", "/messages/foo")
//         }})

//         it("delivers each message once to each client", function() { with(this) {
//           publish(message)
//           expect_message("alice", [message])
//         }})

//         it("delivers the message as many times as it is published", function() { with(this) {
//           publish([message, message])
//           expect_message("alice", [message, message])
//         }})
//       }})
//     }})
//   }})

//   sharedBehavior("distributed engine", function() { with(this) {
//     include(jstest.Helpers)
//     include(EngineSteps)

//     define("create_engine", function() { with(this) {
//       var opts = assign(options(), engineOpts)
//       return new Proxy(opts)
//     }})

//     define("options", function() { return { timeout: 1 } })

//     before(function() { with(this) {
//       this.left   = create_engine()
//       this.right  = create_engine()
//       this.engine = left

//       create_client("alice")
//       create_client("bob")

//       connect("alice", left)
//     }})

//     describe("publish", function() { with(this) {
//       before(function() { with(this) {
//         subscribe("alice", "/foo")
//         publish({ channel: "/foo", data: "first" })
//       }})

//       it("only delivers each message once", function() { with(this) {
//         expect_message("alice", [{ channel: "/foo", data: "first" }])
//         publish({ channel: "/foo", data: "second" })
//         connect("alice", right)
//         expect_message("alice", [{ channel: "/foo", data: "first" }, { channel: "/foo", data: "second" }])
//       }})
//     }})

//     describe("gc", function() { with(this) {
//       define("options", function() { return { timeout: 0.3, gc: 0.08 } })

//       it("calls close in each engine when a client is removed", function() { with(this) {
//         expect_non_exclusive_event("alice", "close", [], this.left);
//         expect_non_exclusive_event("alice", "close", [], this.right);

//         clock_tick(700);
//       }})
//     }})
//   }})
// }})