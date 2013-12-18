;(function (global) {
  function warnMissing (name) {
    return function () {
      console.log('warn: '+name+' missing');
    };
  }

  function extend (o1, o2) {
    for (var key in o2) {
      if (o2.hasOwnProperty(key)) {
        o1[key] = o2[key]
      }
    }
    return o1;
  }

  function merge (o1, o2) {
    var out = {};
    extend(out, o1 || {});
    extend(out, o2 || {});

    return out;
  }

  function clone (o1) {
    return extend({}, o1);
  }

  var Track = function(){
    this.userTracked = false;
    if (!window._gaq) {
      window._gaq = warnMissing('googleanalytics');
      window._gaq.push = warnMissing('googleanalytics');
      window._gaq();
    }
    if (!window._kiq) {
      window._kiq = warnMissing('qualaroo');
      window._kiq.push = warnMissing('qualaroo');
      window._kiq();
    }
    if (!window.olark) {
      window.olark = warnMissing('olark');
      window.olark();
    }
    if (!window.mixpanel) {
      window.mixpanel = warnMissing('mixpanel');
      window.mixpanel();
    }
    this.trackQualarooEvents();
    this.attachOlarkEvents();
  };

  Track.prototype.trackQualarooEvents = function () {
    if (this.trackingOff()) return;
    var self = this;
    _kiq.push(['eventHandler', 'submit', function(data){
      if (data && data.current_fields) {
        data.current_fields.forEach(function (survey) {
          var surveyOptions = { question:survey.question };
          for (var key in survey.answer) {
            surveyOptions['answer_'+key] = survey.answer[key];
          }
          self.event('Qualaroo', 'Survey Answered', surveyOptions);
        });
      }
    }]);
  };

  Track.prototype.attachOlarkEvents = function () {
    olark('api.chat.onBeginConversation', function() {
      olark('api.chat.sendNotificationToOperator', { body: JSON.stringify(this._userInfo) });
    });
  };

  Track.prototype.trackingOff = function() {
    return ($.getQuery && $.getQuery('track') == 'off');
  },

  Track.prototype.user = function (user) {
    if (this.trackingOff()) return;

    var mixpanelUser = clone(user);
    mixpanelUser.$email = user.email
    mixpanelUser.$created = new Date(user.created);
    mixpanelUser.$name = user.username;
    mixpanel.people.set(mixpanelUser);

    if (user._id) this.setUserId(user._id, user.email);
    if (user.email) {
      this.setEmail(user.email, user.username);
      this.setNickname(user);
    }

    olark('api.visitor.updateCustomFields', user);
    this.initIntercom(user);
    this._userInfo = user;
  };

  Track.prototype.setUserId = function (userId, email) {
    if (!this.userTracked) { // dont push identification to services multiple times..
      this.userTracked = true;
      //google analytics
      ////na
      //mixpanel
      mixpanel.alias(userId);
      mixpanel.identify(userId);
      //qualaroo
      _kiq.push(['identify', email || userId]);
    }
  };

  Track.prototype.setEmail = function (email) {
    // mixpanel.people.set({$email:email}); set in user method
    olark('api.visitor.updateEmailAddress', {emailAddress:email});
  };

  Track.prototype.setNickname = function (user) {
    // mixpanel.people.set({$name:user.username}); set in user method
    mixpanel.name_tag(user.username || user.email);
  };

  Track.prototype.initIntercom = function (user) {
    if (!user.permission_level || user.permission_level < 1) {
      console.log('no intercom');
      return;
    }
    console.log('added intercom');

    window.intercomSettings = merge(window.CONFIG.intercom, user);
    intercomSettings.user_id = user._id;
    intercomSettings.name = user.username;
    if (user.created) {
      intercomSettings.created_at = Date.parse(user.created)/1000; // unix
    }

    // intercom script
    var w = window;
    var ic = w.Intercom;
    if (typeof ic === "function") {
      ic('reattach_activator');
      ic('update', intercomSettings);
    } else {
      var d = document;
      var i = function() {
        i.c(arguments)
      };
      i.q = [];
      i.c = function(args) {
        i.q.push(args)
      };
      w.Intercom = i;

      function l() {
        var s = d.createElement('script');
        s.type = 'text/javascript';
        s.async = true;
        s.src = 'https://static.intercomcdn.com/intercom.v1.js';
        var x = d.getElementsByTagName('script')[0];
        x.parentNode.insertBefore(s, x);
      }
      // MODIFIED BELOW
      // if (w.attachEvent) {
      //   w.attachEvent('onload', l);
      // } else {
      //   w.addEventListener('load', l, false);
      // }
      l();
    }
  };

  Track.prototype.backboneRequestError = function (modelOrCollection, xhr, options) {
    var opts = {};
    if (options) {
      opts.url = options.url.replace('/api/-/', '/');
    }
    if (xhr) {
      opts.responseText = xhr.responseText;
      opts.status = xhr.status;
    }
    var model, collection;
    if (modelOrCollection instanceof Backbone.Model) {
      model = modelOrCollection
      opts.modelName = model.constructor.id;
      opts.modelId   = model.id;
    }
    else if (modelOrCollection instanceof Backbone.Collection) {
      collection = modelOrCollection;
      opts.collectionName = collection.constructor.id;
      opts.collectionParams = JSON.stringify(collection.params);
    }
    for (var key in opts) { // if opts is not empty
      this.event('Error', 'ResponseError', opts);
      break;
    }
  };

  Track.prototype.pageView = function() {
    if (this.trackingOff()) {
      return;
    }
    var page = window.location.pathname + window.location.hash;
    console.log('<PAGE>', page);
    var referrer = document.referrer;
    // google analytics page tracking
    _gaq.push(['_trackPageview', page]);
    // mixpanel
    mixpanel.track_pageview(page);
    mixpanel.track('Page Visit', {'Viewed URL':page});
  };

  Track.prototype.event = function(eventCategory, eventName, properties) {
    if (this.trackingOff()) {
      return;
    }
    var page = window.location.pathname + window.location.hash;
    properties = properties || {};
    properties['Viewed URL'] = page;
    //console
    console.log('<EVENT>', eventCategory, '-', eventName, properties);
    //google analytics
    _gaq.push(['_trackEvent', eventCategory, eventName, page]);
    //mixpanel
    mixpanel.track(eventCategory+' - '+eventName, properties);
  };

  Track.prototype.hideSurvey = function() {
    var hideSurvey = function() {
      if (window.KI) {
         window.KI.hide_survey();
         window.KI.show_survey = function(){};
         console.log('hide_survey');
      }
      else {
         console.log('hide_survey - timeout');
         setTimeout(function(){hideSurvey();}, 20);
       }
    };

    hideSurvey();
  };

  Track.prototype.increment = function () {
    mixpanel.people.increment.apply(mixpanel.people, arguments);
  };


  if (global.define) {
    define([], function() {
      return new Track();
    });
  }
  else if (global.module) {
    module.exports = new Track();
  }
  else if (global.exports) {
    exports = new Track();
  }
  else {
    global.Track = new Track();
  }
})(window);