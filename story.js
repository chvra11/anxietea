// Created with Squiffy 5.1.0
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
            var incDecRegex = /^([\w]*)\s*([\+\-])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
                rhs = parseFloat(incDecMatch[3]);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);

            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '22d668eea4';
squiffy.story.sections = {
	'_default': {
		'text': "<p>Before we start on our adventure, we would like to find out a few things about you...</p>\n<p>Are you an <a class=\"squiffy-link link-section\" data-section=\"startType, type = extrovert\" role=\"link\" tabindex=\"0\">extrovert</a> or an <a class=\"squiffy-link link-section\" data-section=\"startType, type = introvert\" role=\"link\" tabindex=\"0\">introvert</a>?</p>",
		'passages': {
		},
	},
	'startType': {
		'text': "<p>You&#39;re an {type}.</p>\n<p>Now...</p>\n<p>Favorite Class: <a class=\"squiffy-link link-section\" data-section=\"startMath, fav=math, favno = 1\" role=\"link\" tabindex=\"0\">Math</a>, <a class=\"squiffy-link link-section\" data-section=\"startEng, fav=english, favno = 2\" role=\"link\" tabindex=\"0\">English</a>, <a class=\"squiffy-link link-section\" data-section=\"startSci, fav=science, favno = 3\" role=\"link\" tabindex=\"0\">Science</a>, <a class=\"squiffy-link link-section\" data-section=\"startHis, fav=history, favno = 4\" role=\"link\" tabindex=\"0\">History</a></p>",
		'passages': {
		},
	},
	'startMath': {
		'text': "<p>Looks like your favorite class is {fav}.</p>\n<p>Least Favorite Class: <a class=\"squiffy-link link-section\" data-section=\"start2, least=english, leastno = 2\" role=\"link\" tabindex=\"0\">English</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=science, leastno = 3\" role=\"link\" tabindex=\"0\">Science</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=history, leastno = 4\" role=\"link\" tabindex=\"0\">History</a></p>",
		'passages': {
		},
	},
	'startEng': {
		'text': "<p>Looks like your favorite class is {fav}.</p>\n<p>Least Favorite Class: <a class=\"squiffy-link link-section\" data-section=\"start2, least=math, leastno = 1\" role=\"link\" tabindex=\"0\">Math</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=science, leastno = 3\" role=\"link\" tabindex=\"0\">Science</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=history, leastno = 4\" role=\"link\" tabindex=\"0\">History</a></p>",
		'passages': {
		},
	},
	'startSci': {
		'text': "<p>Looks like your favorite class is {fav}.</p>\n<p>Least Favorite Class: <a class=\"squiffy-link link-section\" data-section=\"start2, least=math, leastno = 1\" role=\"link\" tabindex=\"0\">Math</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=english, leastno = 2\" role=\"link\" tabindex=\"0\">English</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=history, leastno = 4\" role=\"link\" tabindex=\"0\">History</a></p>",
		'passages': {
		},
	},
	'startHis': {
		'text': "<p>Looks like your favorite class is {fav}.</p>\n<p>Least Favorite Class: <a class=\"squiffy-link link-section\" data-section=\"start2, least=math, leastno = 1\" role=\"link\" tabindex=\"0\">Math</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=english, leastno = 2\" role=\"link\" tabindex=\"0\">English</a>, <a class=\"squiffy-link link-section\" data-section=\"start2, least=science, leastno = 3\" role=\"link\" tabindex=\"0\">Science</a></p>",
		'passages': {
		},
	},
	'start2': {
		'text': "<p>And your least favorite class is {least}.</p>\n<p>Your birthday month: <a class=\"squiffy-link link-section\" data-section=\"start3, birth= January, season=a winter\" role=\"link\" tabindex=\"0\">January</a>, <a class=\"squiffy-link link-section\" data-section=\"start3,birth=February, season=a winter\" role=\"link\" tabindex=\"0\">February</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=March,season=either a winter or a spring\" role=\"link\" tabindex=\"0\">March</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=April, season=a spring\" role=\"link\" tabindex=\"0\">April</a>,<br><a class=\"squiffy-link link-section\" data-section=\"start3,birth=May, season=a spring\" role=\"link\" tabindex=\"0\">May</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=June, season=either a spring or a summer\" role=\"link\" tabindex=\"0\">June</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=July, season=a summer\" role=\"link\" tabindex=\"0\">July</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=August, season=a summer\" role=\"link\" tabindex=\"0\">August</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=September, season=either a summer or a fall\" role=\"link\" tabindex=\"0\">September</a>, <a class=\"squiffy-link link-section\" data-section=\"start3,birth=October, season=a fall\" role=\"link\" tabindex=\"0\">October</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=November, season=a fall\" role=\"link\" tabindex=\"0\">November</a>, \n<a class=\"squiffy-link link-section\" data-section=\"start3,birth=December, season=either a fall or a winter\" role=\"link\" tabindex=\"0\">December</a></p>",
		'passages': {
		},
	},
	'start3': {
		'text': "<p>And you were born in {birth}, making you {season} baby.</p>\n<p>Pick a gender for your friend: <a class=\"squiffy-link link-section\" data-section=\"startMale, gender=male\" role=\"link\" tabindex=\"0\">male</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFemale, gender=female\" role=\"link\" tabindex=\"0\">female</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startOther, gender=other\" role=\"link\" tabindex=\"0\">other</a></p>",
		'passages': {
		},
	},
	'startMale': {
		'text': "<p>Choose a name for your friend:\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Trevor\" role=\"link\" tabindex=\"0\">Trevor</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Chad\" role=\"link\" tabindex=\"0\">Chad</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= James\" role=\"link\" tabindex=\"0\">James</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Luke\" role=\"link\" tabindex=\"0\">Luke</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Chase\" role=\"link\" tabindex=\"0\">Chase</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Christian\" role=\"link\" tabindex=\"0\">Christian</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Dereck\" role=\"link\" tabindex=\"0\">Dereck</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Evan\" role=\"link\" tabindex=\"0\">Evan</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Grant\" role=\"link\" tabindex=\"0\">Grant</a></p>",
		'passages': {
		},
	},
	'startFemale': {
		'text': "<p>Choose a name for your friend:\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Alexis\" role=\"link\" tabindex=\"0\">Alexis</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Becca\" role=\"link\" tabindex=\"0\">Becca</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Kate\" role=\"link\" tabindex=\"0\">Kate</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Elizabeth\" role=\"link\" tabindex=\"0\">Elizabeth</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Zoe\" role=\"link\" tabindex=\"0\">Zoe</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Sydney\" role=\"link\" tabindex=\"0\">Sydney</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Brittany\" role=\"link\" tabindex=\"0\">Brittany</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Candace\" role=\"link\" tabindex=\"0\">Candace</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Imani\" role=\"link\" tabindex=\"0\">Imani</a></p>",
		'passages': {
		},
	},
	'startOther': {
		'text': "<p>Choose a name for your friend:\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Alex\" role=\"link\" tabindex=\"0\">Alex</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Riley\" role=\"link\" tabindex=\"0\">Riley</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Devin\" role=\"link\" tabindex=\"0\">Devin</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Taylor\" role=\"link\" tabindex=\"0\">Taylor</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Pat\" role=\"link\" tabindex=\"0\">Pat</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Sam\" role=\"link\" tabindex=\"0\">Sam</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Charlie\" role=\"link\" tabindex=\"0\">Charlie</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Skyler\" role=\"link\" tabindex=\"0\">Skyler</a>,\n<a class=\"squiffy-link link-section\" data-section=\"startFriend, name= Jessie\" role=\"link\" tabindex=\"0\">Jessie</a></p>",
		'passages': {
		},
	},
	'startFriend': {
		'text': "<p>Your friend&#39;s name is {name}.</p>\n<p>Great! Click <a class=\"squiffy-link link-section\" data-section=\"HERE\" role=\"link\" tabindex=\"0\">HERE</a> to begin the story!</p>",
		'passages': {
		},
	},
	'HERE': {
		'text': "<p>You hear the back door slam and wake up with a start. </p>\n<p>You look at your clock. </p>\n<p>It&#39;s half an hour past the time your alarm was supposed to go off. </p>\n<p>You always leave yourself plenty of time to get ready in the morning, so 30 minutes won&#39;t make you late to school.</p>\n<p>However, this will certainly throw you off and take away your time to mentally prepare yourself for the day. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont1\" role=\"link\" tabindex=\"0\">Get out of bed.</a></p>",
		'passages': {
		},
	},
	'cont1': {
		'text': "<p>You dart out of bed and race into some dirty clothes. </p>\n<p>You forgot to do laundry over the weekend. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont2\" role=\"link\" tabindex=\"0\">Leave your room.</a></p>",
		'passages': {
		},
	},
	'cont2': {
		'text': "<p>You sprint downstairs. </p>\n<p>On your way out the door, you catch a glimpse of some wrapped packages sitting on the kitchen table . </p>\n<p>You assume that the reason your mom didn&#39;t wake you up this morning was so that you could sleep in on your birthday. </p>\n<p>But sleeping in peacefully has never been a strong suit of yours.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont3\" role=\"link\" tabindex=\"0\">Leave your house.</a></p>",
		'passages': {
		},
	},
	'cont3': {
		'text': "<p>The next thing you know you are on your way to school. </p>\n<p>Your eyes flit down to the fuel gauge.</p>\n<p>You notice the needle resting on the large white &quot;E&quot;. </p>\n<p>Sh**. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont4\" role=\"link\" tabindex=\"0\">Get off the road.</a></p>",
		'passages': {
		},
	},
	'cont4': {
		'text': "<p>You carefully roll to the side of the road, hands shaking. </p>\n<p>Tears begin to form. </p>\n<p>They sting your eyes and flood your vision. </p>\n<p>You tell yourself everything&#39;s ok.</p>\n<p>You&#39;re ok. </p>\n<p>You take a few deep breaths. </p>\n<p>Why the hell does it feel like every inanimate object is physically latching itself on to you and dragging you down? </p>\n<p>Thoughts of your birthday are completely forgotten.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont5\" role=\"link\" tabindex=\"0\">Begin to compose yourself.</a></p>",
		'passages': {
		},
	},
	'cont5': {
		'text': "<p>Your mind focuses on your appearance. </p>\n<p>You don&#39;t want you&#39;re face to get all red and blotchy from crying.</p>\n<p>You dig your fingernails into the palm of your hands in an effort to physically stop the tears.</p>\n<p>You remind yourself that you still have to make it to school and through the day. </p>\n<p>You finally collect yourself after sitting on the side of the road for 10 minutes.</p>\n<p>You consider either <a class=\"squiffy-link link-passage\" data-passage=\"calling your friend\" role=\"link\" tabindex=\"0\">calling your friend</a> or <a class=\"squiffy-link link-passage\" data-passage=\"walking to school\" role=\"link\" tabindex=\"0\">walking to school</a>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"call\" role=\"link\" tabindex=\"0\">call</a> or <a class=\"squiffy-link link-section\" data-section=\"walk\" role=\"link\" tabindex=\"0\">walk</a>.</p>",
		'passages': {
			'calling your friend': {
				'text': "<p>You would call {name}, making both you and your friend late to school, but not so late that you miss first period.</p>",
			},
			'walking to school': {
				'text': "<p>You would walk to school, making you very late, but leaving your friend out of it.</p>",
			},
		},
	},
	'call': {
		'text': "<p>You called {name}.</p>\n<p>You both arrive 15 minutes late for first period, which is your favorite class, {fav}.</p>\n<p>Its the middle of the lecture.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont6\" role=\"link\" tabindex=\"0\">Get to your seat.</a></p>",
		'passages': {
		},
	},
	'cont6': {
		'text': "<p>You have to walk all the way across the room to your seat in the back.</p>\n<p>You can do nothing but hope you don&#39;t look as upset as you feel. </p>\n<p>All eyes are on you as you go to collect your seat, even your teacher&#39;s.</p>\n<p>You feel them burning holes into your body as you silently cross the  classroom.</p>\n<p>Again, your eyes begin to sting.</p>\n<p>You impulsively begin to clench your jaw and dig your nails into your palms. </p>\n<p>You beg yourself:</p>\n<p>Calm down, please.</p>\n<p>You can feel your face burn. </p>\n<p>There&#39;s nothing you can do at this point. </p>\n<p>Your teacher definitely notices how close you are to running out and quickly continues her lecture to bring attention to the front of the room.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont7\" role=\"link\" tabindex=\"0\">Class ends.</a></p>",
		'passages': {
		},
	},
	'cont7': {
		'text': "<p>You finally make it through first period.</p>\n<p>You send {name} multiple apology texts for making them late this morning. </p>\n<p>Your friend keeps telling you everything&#39;s fine, but you can&#39;t escape feeling like you screwed up.</p>\n<p>{name}&#39;s day is probaly ruined too.</p>\n<p>Your friend jokes and calls the last-minute ride to school a birthday present.</p>\n<p>This somehow makes you feel worse.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cont8\" role=\"link\" tabindex=\"0\">Head to {least}.</a></p>",
		'passages': {
		},
	},
	'cont8': {
		'text': "<p>You walk to {least} with your head down and dodging people&#39;s eyes in the hallway. </p>\n<p>On your way to class you pass by your locker...\n{if type=extrovert: it&#39;s not decorated. </p>\n<p>That&#39;s the last thing you need.</p>\n<p>You couldn&#39;t feel more alone right now.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"period2\" role=\"link\" tabindex=\"0\">Breathe and get to {least}</a>.}</p>\n<p>{else: it&#39;s decorated.</p>\n<p>That&#39;s the last thing you need.</p>\n<p>You can hear the whispers and sense the sideways glances.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"period2\" role=\"link\" tabindex=\"0\">Keep your head down and get to {least}</a>.}</p>",
		'passages': {
		},
	},
	'walk': {
		'text': "<p>You walk to school.</p>\n<p>You get to school late, missing {fav}, but arriving just in time for your second period class, {least}. </p>\n<p>On your way to {least} you stop at your locker...\n{if type = extrovert: it&#39;s not decorated.</p>\n<p>That&#39;s the last thing you need.</p>\n<p>You couldn&#39;t feel more alone right now.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"period2\" role=\"link\" tabindex=\"0\">Breathe and get to {least}</a>.}\n{else: it&#39;s decorated.</p>\n<p>That&#39;s the last thing you need.</p>\n<p>You can hear the whispers and sense the sideways glances.</p>\n<p>Great. Now everyone knows it&#39;s your birthday.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"period2\" role=\"link\" tabindex=\"0\">Keep your head down and get to {least}</a>.}</p>",
		'passages': {
		},
	},
	'period2': {
		'text': "<p>You enter {least} class and notice what&#39;s written on the board.</p>\n<p>&quot;POP QUIZ&quot;</p>\n<p>Not only is {least} your least favorite class but it&#39;s also your worst class.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"quiz\" role=\"link\" tabindex=\"0\">Take the Quiz</a>.</p>",
		'passages': {
		},
	},
	'quiz': {
		'text': "<p>Shaking, you take your seat and begin the quiz.</p>\n<p>You can barely write your name on your paper before the tears threaten to escape.</p>\n<p>Your breathing becomes uneven and shakey - people begin to notice and you feel their stares watching every move you make.</p>\n<p>You begin to read the first question, but none of the words make sense to you.</p>\n<p>There is nothing you can do - you are aboslutely on your own. What&#39;s worse, everyone is watching you fail. </p>\n<p>Everyone - everything - is against you. </p>\n<p>You hand in your quiz, blank.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"lunch\" role=\"link\" tabindex=\"0\">Go to lunch.</a></p>",
		'passages': {
		},
	},
	'lunch': {
		'text': "<p>You enter the cafeteria and feel nervous when you see your friends.</p>\n<p>You suddenly become hyper aware of your appearance.</p>\n<p>Your shaking now - there&#39;s no controlling that - and your eyes are undoubtedly puffy and red.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"approach\" role=\"link\" tabindex=\"0\">Approach your friends.</a></p>",
		'passages': {
		},
	},
	'approach': {
		'text': "<p>As you approach the lunch table you notice that your usual seat has been taken.</p>\n<p>You stand there next to your usual seat.</p>\n<p>Instead of your friend moving out of your seat, eveyone looks up at you and \n{if type=extrovert: no one says happy birthday to you.</p>\n<p>Everyone seems to have forgotten about you; your birthday and your presence seem to mean nothing to them.}\n{else: says happy birthday to you.</p>\n<p>That is the last thing you want to hear from them.</p>\n<p>At this point, you don&#39;t even know what the first thing you want to hear would be.</p>\n<p>You are finding fewer and fewer things capable of calming you down.}</p>\n<p>You can&#39;t even make your way to a new seat.</p>\n<p>No amount of fingernail digging can control the tears. You need to leave.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"counselor\" role=\"link\" tabindex=\"0\">Go to your counselor.</a></p>",
		'passages': {
		},
	},
	'counselor': {
		'text': "<p>You know visiting your counselor rarely makes you feel better, but anything is better than being vulnerable in front of your friends.</p>\n<p>Your counselor says exactly what you expected him to say - take a few deep breaths, sit in that chair until next period, then go back to class.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"class\" role=\"link\" tabindex=\"0\">Go to class</a> or <a class=\"squiffy-link link-section\" data-section=\"leave\" role=\"link\" tabindex=\"0\">try to leave anyway</a>.</p>",
		'passages': {
		},
	},
	'class': {
		'text': "<p>You head into the hallway to make your way to class when you here the passing period bell ring.</p>\n<p>Despite breathing deeply for the past 30 minutes you enter class shaking and fragile.</p>\n<p>Everything is wrong and no matter what you do it will never be ok.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"attack\" role=\"link\" tabindex=\"0\">Suffer an anxiety attack.</a></p>",
		'passages': {
		},
	},
	'leave': {
		'text': "<p>You leave the counselling department on the brink of tears.</p>\n<p>You have to choose between <a class=\"squiffy-link link-passage\" data-passage=\"mom\" role=\"link\" tabindex=\"0\">calling your mom</a> or <a class=\"squiffy-link link-passage\" data-passage=\"nurse\" role=\"link\" tabindex=\"0\">going to the nurse</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"callMom\" role=\"link\" tabindex=\"0\">call</a> or <a class=\"squiffy-link link-section\" data-section=\"goNurse\" role=\"link\" tabindex=\"0\">go</a></p>",
		'passages': {
			'mom': {
				'text': "<p>You would call your mom, who doesn&#39;t believe that anxiety is a real mental illness and will push you to finish out the day.</p>",
			},
			'nurse': {
				'text': "<p>You would fake a migraine and convince your nurse to let you &quot;sleep it off.&quot;</p>",
			},
		},
	},
	'callMom': {
		'text': "<p>Your mom responds exactly how you predicted she would.</p>\n<p>Few things hurt as much as your own mom failing to acknowledge your pain.</p>\n<p>You hurry to the nearest restroom.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"attack\" role=\"link\" tabindex=\"0\">Suffer an anxiety attack.</a></p>",
		'passages': {
		},
	},
	'goNurse': {
		'text': "<p>You hurry into the nurse&#39;s office.</p>\n<p>You explain that you are suffering from a terrible migraine.</p>\n<p>The nurse allows you to stay for 2 periods max.</p>\n<p>You walk over to one of the beds and pull the curtains shut.</p>\n<p>You can do nothing but think of all the people you let down today, all the friends you lost, all the grades that dropped.</p>\n<p>Your breathing picks up, the tears to fall.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"attack\" role=\"link\" tabindex=\"0\">Suffer an anxiety attack.</a></p>",
		'passages': {
		},
	},
	'attack': {
		'text': "<p>You suddenly feel yourself lose control of your body.</p>\n<p>No matter how much you want to, you can&#39;t move your limbs.</p>\n<p>Someone is sitting on your chest, and you feel the pressure increase every second.</p>\n<p>You attempt to calm yourself, but you can&#39;t seem to catch your breath.</p>\n<p>You know your hands are shaking and the tears are flowing, and there&#39;s nothing you can do.</p>\n<p>You are not attached to your body, only to your inner pain and distress.</p>\n<p>Your vision blurs and you continue to hyperventilate.</p>\n<p>The only thing you can think of is how you must appear to others right now.</p>\n<p>The man sitting on your chest seems to grow heavier.</p>\n<p>All you want is to gain at least a little bit of control over yourself.</p>\n<p>You want to be anywhere else, doing anything else.</p>\n<p>You cannot.</p>\n<p>You are trapped.</p>",
		'passages': {
		},
	},
}
})();