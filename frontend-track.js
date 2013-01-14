define([], function() {
  var Track = function(){
    this.userTracked = false;
  };

  Track.prototype.trackingOff = function() {
    return ($.getQuery && $.getQuery('track') == 'off');
  },

  Track.prototype.user = function(userId) {
    if (this.trackingOff()) {
      return;
    }
    if (!this.userTracked) { // dont push identification to services multiple times..
      this.userTracked = true;
      //kissmetrics
      _kmq.push(['identify', userId]);
      //google analytics
      ////na
      //mixpanel
      mixpanel.identify(userId);
      //qualaroo
      _kiq.push(['identify', userId]);
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
    console.log('<EVENT>', eventCategory, eventName);
    properties = properties || {};
    properties['Viewed URL'] = page;
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

  return new Track();
});