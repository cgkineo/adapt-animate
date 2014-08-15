/*
* adapt-animate
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define(function(require) {

	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');
	var Emmet = require('extensions/adapt-animate/js/emmet.min');
	var OnScreen = require('extensions/adapt-animate/js/onscreen');
	var elements = [ "global", "contentObjects", "articles", "blocks", "components" ];
	var config = undefined;

	var attrs = function(object) {
            // Get attributes
            var a = {};
            if (object) {
                var atts = object.attributes;
                for (var i in atts) {
                    var p = atts[i];
                    if (typeof p.value !== 'undefined') a[p.nodeName] = p.value;
                }
            }
            return a;
	    };


	var animate = {
		modelJSON: undefined,
		modelAnimate: undefined,
		view: undefined,
		go: function(view, elementType) {
			var model = view.model;
			if (config.length === 0) return;
			if (model.get("_animate") === undefined || model.get("_animate")._isEnabled === false) return;
			
			this.grab(model, view, elementType);
			this.attach.initialize(model, view);

		},
		grab: function(model, view, elementType) {
			var modelJSON = model.toJSON();
			var modelAnimate = model.get("_animate");

			if (modelAnimate._merged === undefined) {

				if (modelAnimate._animations !== undefined) {
					var redo = {};
					var id = 1;
					_.each(modelAnimate._animations, function(item) {
						if (item._id == undefined) item._id = "lan-" + (id++);
						redo[item._id] = item;
					});
					modelAnimate._animations = redo;
				} else {
					modelAnimate._animations = {};
				}

				_.each(config._animations, function(item) {
					if (item._isEnabled === false) return;
					if (item["_"+elementType] === undefined) return;
					if (item["_"+elementType] === true) {
						modelAnimate._animations[item._id] = item;
					} else {
						_.each(item["_"+elementType], function(element) {
							var answer = _.findWhere([modelJSON], element);
							if (answer !== undefined) {
								if (modelAnimate._animations === undefined) modelAnimate._animations = {};
								if (modelAnimate._animations[item._id] !== undefined) return;
								modelAnimate._animations[item._id] = item;
								return;
							}
						});
					}
				});

				modelAnimate._merged = true;
			}
		},
		attach: {
			initialize: function(model, view) {
				var modelAnimate = model.get("_animate");
				var events = [];
				_.each(modelAnimate._animations, function(animation, key) {
					_.each(animation._events, function(actionsOnStrs, eventsOnStr) {
						if (typeof actionsOnStrs == "string") actionsOnStrs = [actionsOnStrs];

						var eventsOn = animate.eventsOn.parse(eventsOnStr);
						eventsOn.orig = actionsOnStrs;
						eventsOn.parent = view.$el;
						eventsOn.children = view.$el.find(eventsOn.on);
						eventsOn.count = 0;
						eventsOn.index = -1;
						eventsOn.actionsOn = animate.actionsOn.parse(actionsOnStrs);

						events.push(eventsOn);
						
					});
				});

				var groupByEvent = _.groupBy(events, function(item) { return item.str; });
				var groupByOn = _.groupBy(events, function(item) { return item.on; });

				_.each(groupByEvent, function(item, key) {
					groupByEvent[key] = {
						count: 0,
						name: key
					};
				});

				_.each(events, function(eventsOn) {
					var copy = $.extend(true,{},eventsOn);
					copy.groupByEvent = groupByEvent[eventsOn.str];
					copy.groupByOn = groupByOn[eventsOn.on];
					animate.attach.create(copy); //, $.extend(true,{},actionsOn));
				});
			},
			create: function(eventsOn) {
				eventsOn.index++;
				var eventObj = eventsOn.events[eventsOn.index];
				var callback = undefined;
				if (eventObj.callback === undefined) {
					eventObj.callback = _.bind(animate.attach.run, eventsOn.children, eventsOn);
				}
				callback = eventObj.callback;
				var mode = "on";
				var live = false;
				switch (eventObj.mode) {
				case "1":
					mode = "one";
					break;	
				case "!":
					mode = "on";
					live = true;
					break;	
				}
				switch(eventObj.name) {
				case "scroll":
					$(window)["on"]("scroll", callback);
					break;
				case "interval":
					if (mode == "one") {
						setTimeout.apply(window, [ function() {
							callback();
							eventsOn.index--;
						}, eventObj.arguments ] );
						break;
					}
					setInterval.apply(window, [ callback, eventObj.arguments ] );
					break;
				case "timeout":
					setTimeout.apply(window, [ function() {
						callback();
						eventsOn.index--;
					}, eventObj.arguments ] );
					break;
				case "inview":
					function inviewCallback(event, onScreen) {
						var $target = $(event.currentTarget);
						
						var isInView = true;
						if (onScreen.inviewP <= 0) isInView = false;

						var inview = $target.attr("onscreen");
						
						if (!isInView && mode == "one" && inview=="onscreen") {
							$target.attr("inview","");
							eventObj.appliedCount--;
							delete eventObj.inview;
							if (eventObj.appliedCount === 0) {
								eventsOn.index--;
								eventsOn.children["off"]("onscreen", inviewCallback);
							}
							return;
						}
						if (!isInView) {
							$target.attr("onscreen","");
							return;
						}
						if (isInView && inview) return;

						if (eventObj.arguments !== undefined && eventObj.arguments[0] !== undefined) {
							if (onScreen.inviewP < parseInt(eventObj.arguments[0])) return;
						}

						$target.attr("onscreen","onscreen");
						if (isInView) {
							callback($target);
						}
					}
					if (live) {
						if (eventObj.appliedCount === 0) eventsOn.parent["on"]("onscreen", eventsOn.on, inviewCallback);
					} else {
						if (eventObj.appliedCount === 0) {
							eventsOn.children["on"]("onscreen", inviewCallback);
						}
					};
					eventObj.appliedCount++;
					break;
				case "outview":
					function outviewCallback(event, onScreen) {
						var onScreen = $(event.currentTarget).onscreen(); //animate.element.getOnScreen($(event.currentTarget));
						var isInView = true;
						if (onScreen.inviewP <= 0) isInView = false;

						if (!isInView) {
							var $target = $(event.currentTarget);
							callback($target);
						}
						if (!isInView && mode == "one") {
							eventObj.appliedCount--;
							if (eventObj.appliedCount === 0) {
								eventsOn.index--;
								eventsOn.children["off"]("onscreen", outviewCallback);
							}
						}
					}
					if (live) {
						if (eventObj.appliedCount === 0) eventsOn.parent["on"]("onscreen", eventsOn.on, outviewCallback);
					} else {
						if (eventObj.appliedCount === 0) eventsOn.children["on"]("onscreen", outviewCallback);
					}
					eventObj.appliedCount++;
					break;
				default:
					if (live) {
						if (eventObj.appliedCount === 0) eventsOn.parent[mode](eventObj.name, eventsOn.on, callback );
					} else {
						switch(mode) {
						case "one":
							if (eventObj.appliedCount === 0) eventsOn.children[mode](eventObj.name, function() {
								callback();
								eventsOn.index--;
							} );
							break;
						case "on":
							if (eventObj.appliedCount === 0) eventsOn.children[mode](eventObj.name, callback );
							break;
						}
						
					}
					break;
				}
			},
			run: function(eventsOn, target) {
				var back = false;
				if (eventsOn.index < eventsOn.events.length - 1) {
					back = (eventsOn.events[eventsOn.index + 1].mode == "<");
				}
				if (eventsOn.index < eventsOn.events.length - 1 && !back) {
					animate.attach.create(eventsOn);
				} else {
					eventsOn.count++;
					eventsOn.groupByEvent.count++;
					eventsOn.groupByOn.count++;
					_.each(eventsOn.actionsOn, function(actionOn) {
						eventsOn.children = eventsOn.parent.find(eventsOn.on);
						var elements = undefined;
						if (actionOn.on !== undefined) {
							elements = eventsOn.parent.find(actionOn.on);
						} else {
							elements = (target || eventsOn.children); //eventsOn.children
						}
						actionOn.count++;
						var from = undefined;
						var to = undefined;
						for (var i = 0; i < elements.length; i++) {
							var index = (actionOn.action.direction == "backward" ? (elements.length - 1) - i : i);
							var $element = $(elements[index]);

							var onScreen = $element.onscreen(); //animate.element.getOnScreen($element);
							
							var alt = animate.attach.expandContext(actionOn.alterations, eventsOn.groupByEvent.count, eventsOn.groupByOn.count, eventsOn.count, actionOn.count, index, i, onScreen);
							var alterations = $(emmet.expandAbbreviation(alt,"plain"))[0];
							var attributes = attrs(alterations);
							var content = undefined;
							if ($(alterations).html() > "") content = $(alterations).html();
							
							var interval = undefined;
							if (actionOn.action.interval === undefined) interval = 0;
							else interval = animate.attach.calculateContext(actionOn.action.interval, eventsOn.groupByEvent.count, eventsOn.groupByOn.count, eventsOn.count, actionOn.count, index, i, onScreen);
							switch (actionOn.action.type) {
							case "add":
								var callback =  _.bind(function($element, attributes, content) {
									_.each(attributes, function(value, key) {
										if (key == "class") {
											$element.addClass(value);
										} else {
											$element.attr(key, value);
										}
									});
									$element.html(content);
								}, window, $element, attributes, content);
								
								if (interval > 0) setTimeout( callback, interval);
								else callback();
								break;
							case "remove":
								var callback = _.bind(function($element, attributes, content) {
									_.each(attributes, function(value, key) {
										if (key == "class") {
											$element.removeClass(value);
										} else {
											$element.attr(key, "");
										}
									});
									$element.html(content);
								}, window, $element, attributes, content);
								
								if (interval > 0) setTimeout( callback, interval);
								else callback();
								break;
							}
						}
					});
					if (back) {
						eventsOn.index = parseInt(eventsOn.events[eventsOn.index + 1].name) - 1;
						animate.attach.create(eventsOn);
					}
				}
			},
			calculateContext: function(string, ge, gs, e, x, ni, i, onScreen) {
				var string = animate.attach.expandContext(string, ge, gs, e, x, ni, i, onScreen);
				string = eval(string);
				return string;
			},
			expandContext: function(string, ge, gs, e, x, ni, i, onScreen) {
				string = string.replace(/\$iv%d/g, onScreen.inviewP/100);
				string = string.replace(/\$iv%/g, onScreen.inviewP);
				string = string.replace(/\$e/g, e);
				string = string.replace(/\$le/g, e-1);
				string = string.replace(/\$ne/g, e+1);
				string = string.replace(/\$ge/g, ge);
				string = string.replace(/\$lge/g, ge-1);
				string = string.replace(/\$nge/g, ge+1);
				string = string.replace(/\$gs/g, gs);
				string = string.replace(/\$lgs/g, gs-1);
				string = string.replace(/\$ngs/g, gs+1);
				string = string.replace(/\$x/g, x);
				string = string.replace(/\$lx/g, x-1);
				string = string.replace(/\$nx/g, x+1);
				string = string.replace(/\$ni/g, ni);
				string = string.replace(/\$i/g, i);
				string = string.replace(/\$t%d/g, onScreen.topP/100);
				string = string.replace(/\$r%d/g, onScreen.rightP/100);
				string = string.replace(/\$b%d/g, onScreen.bottomP/100);
				string = string.replace(/\$l%d/g, onScreen.leftP/100);
				string = string.replace(/\$t%/g, onScreen.topP);
				string = string.replace(/\$r%/g, onScreen.rightP);
				string = string.replace(/\$b%/g, onScreen.bottomP);
				string = string.replace(/\$l%/g, onScreen.leftP);
				string = string.replace(/\$t/g, onScreen.top);
				string = string.replace(/\$r/g, onScreen.right);
				string = string.replace(/\$b/g, onScreen.bottom);
				string = string.replace(/\$l/g, onScreen.left);
				return string;
			}
		},
		event: {
			parse: function(event) {
				var mode = "";
				switch (event.substr(0,1) ) {
				case "1":
					mode = "1";
					event = event.substr(1);
					break;
				case "!":
					mode = "!";
					event = event.substr(1);
					break;
				case "<":
					mode = "<";
					event = event.substr(1);
					break;
				}
				if (event.indexOf("(") > -1 && event.indexOf(")") > -1) {
					var eventName = event.substr(0, event.indexOf("("));
					var args = event.substr(event.indexOf("("));
					args = eval("[" + args + "]");
					return { name: eventName, arguments: args, mode: mode, appliedCount: 0 };
				} else {
					return { name: event, mode: mode, appliedCount: 0 };
				}
			}
		},
		eventsOn: {
			parse: function(eventsOn) {
				eventsOn = eventsOn.trim();
				var parts = eventsOn.split(" ");
				if (parts.length < 2) throw eventsOn + " does not have both an event and a selector";
				var events = animate.eventsOn.parseEvents(parts[0]);
				events.str = parts[0];
				events.on = animate.eventsOn.parseOn(parts[1]);
				return events;
			},
			parseEvents: function(events) {
				events = events.trim();
				var parts = events.split(">");
				var redo = [];
				_.each(parts, function(event) {
					redo.push(animate.event.parse(event));
				});
				return { events: redo };
			},
			parseOn: function(on) {
				on = on.trim();
				if (on.substr(0,1) == "'" && on.substr(on.length-1) == "'") return on.substr(1, on.length-2);
				return on;
			}
		},
		actionsOn: {
			parse: function(actionsOn) {
				var redo = [];
				_.each(actionsOn, function(actionOn) {
					actionOn = actionOn.trim();
					var parts = actionOn.split(" ");
					if (parts.length < 1) throw actionOn + " does not have both an alteration";
					if (parts.length == 1) {
						var alterations = animate.actionsOn.parseAlterations(parts[1]);
						redo.push( { alterations: alterations } );	
						return;
					} else if (parts.length == 2) {
						var action = animate.actionsOn.parseAction(parts[0]);
						var alterations = animate.actionsOn.parseAlterations(parts[1]);
						redo.push( { action: action, alterations: alterations } );
						return;
					} else if (parts.length > 3) {
						var ends = parts.splice(2);
						parts[2] = ends.join(' ');
					}
					var action = animate.actionsOn.parseAction(parts[0]);
					var alterations = animate.actionsOn.parseAlterations(parts[1]);
					var on = animate.actionsOn.parseOn(parts[2]);
					redo.push( { action: action, alterations: alterations, on: on, count: 0 } );
					return;
				});
				return redo;
			},
			parseAction: function(action) {
				action = action.trim();
				var type = undefined;
				var direction = undefined;
				var interval = undefined;
				switch (action.substr(0,1)) {
				case "-":
					type = "remove";
					action = action.substr(1);
					break;
				case "+":
					type = "add";
					action = action.substr(1);
					break;
				default:
					type = "add";
				}
				if (action.substr(0,1) == "(" && action.substr(action.length-1) == ")") action = action.substr(1, action.length-2);
				switch (action.substr(0,1)) {
				case ">":
					direction = "forward";
					action = action.substr(1);
					break;
				case "<":
					direction = "backward";
					action = action.substr(1);
					break;
				default:
					direction = "foward";
				}
				if (action.length > 0) interval = action;
				var rtn = {};
				if (type !== undefined) rtn.type = type;
				if (direction !== undefined) rtn.direction = direction;
				if (interval !== undefined) rtn.interval = interval;
				return rtn;

			},
			parseAlterations: function(alterations) {
				alterations = alterations.trim();
				if (alterations.substr(0,1) == "'" && alterations.substr(alterations.length-1) == "'") return alterations.substr(1, alterations.length-2);
				return alterations;
			},
			parseOn: function(on) {
				on = on.trim();
				if (on.substr(0,1) == "'" && on.substr(on.length-1) == "'") return on.substr(1, on.length-2);
				return on;
			}
		}
	};


	Adapt.on("app:dataReady", function() {
		if (Adapt.course.get("_animate") === undefined) return;
		var id = 1;
		var _animate = Adapt.course.get("_animate");
		_.each(_animate._animations, function(item) {
			if (item._id == undefined) item._id = "glan-" + (id++);
		});
		config = _animate;

		var view = {};
		view.$el = $("body");
		view.model = new Backbone.Model({
			"_animate": {
				"_isEnabled": true
			}
		});
		animate.go(view, "global");
	});


	Adapt.on("pageView:postRender", function(view) {
		animate.go(view, "contentObjects");
	});
	Adapt.on("articleView:postRender", function(view) {
		animate.go(view, "articles");
	});
	Adapt.on("blockView:postRender", function(view) {
		animate.go(view, "blocks");
	});
	Adapt.on("componentView:postRender", function(view) {
		animate.go(view, "components");
	});

})
