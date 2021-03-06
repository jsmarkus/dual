var boop = require('boop');
var Obj = require('./Object');
var utils = require('./utils');
var esc = utils.escape;
var ERR = require('./error');
var bean = require('./bean');
var events = require('events');

var EventEmitter = events.EventEmitter;

var Node = Obj.extend({
    tagname: 'div',
    parent: null,

    initialize: function() {
        Obj.prototype.initialize.apply(this, arguments);
        // this._ = {};
        this.children = [];
        this._domEvents = {};
        this._domProperties = {};
    },

    // setAttribute: function(name, value) {
    //     this._[name] = value;
    //     this.applyAttribute(name, value);
    // },

    setProperty: function(name, value) {
        this._setDomProperty(name, value);
        this._domify_setProperty(name, value);
    },

    getProperty: function(name, value) {
        if(this._isDomified()) {
            return this.el[name];
        }
        return this._getDomProperty(name);
    },

    _getDomProperty: function(name, value) {
        return this._domProperties[name];
    },

    _setDomProperty: function(name, value) {
        this._domProperties[name] = value;
    },

    _domify_setProperty: function (name, value) {
        if(this._isDomified()) {
            this.el[name] = value;
        }
    },

    _isDomified: function () {
        return !!(this.el);
    },


    applyAttributeDefault: function(value, options) {
        var attrName = options.attrName;
        this._domify_applyAttribute(attrName, value);
    },
    // applyAttribute: function(attrName, value) {
    //     var path = this._getAttributePath(attrName);
    //     var name = path.name;
    //     var ns = path.nameSpace

    //     if(ns) {
    //         var nsApplier = 'applyAttributeNs_' + ns;
    //         if ('function' === typeof this[nsApplier]) {
    //             this[nsApplier].call(this, name, value);
    //             return;
    //         }
    //     }

    //     var applier = 'applyAttribute_' + name;
    //     if ('function' === typeof this[applier]) {
    //         this[applier].call(this, value);
    //         return;
    //     }

    //     this._domify_applyAttribute(name, value);
    // },

    _domify_applyAttribute: function(name, value) {
        if(!this.__isAttrVisible(name)) {
            return;
        }
        if (this.el) {
            if (true === value) {
                this.el.setAttribute(name, name);
            } else if (false === value || null === value || undefined === value) {
                this.el.removeAttribute(name);
            } else {
                this.el.setAttribute(name, value);
            }
        }
    },

    // getAttribute: function(name) {
    //     return this._[name];
    // },

    appendChild: function(node) {
        //а еще тут где-то надо синхронизировать изменения на реальный DOM, если он есть.
        throwIfSelfClosing(this);
        if (node.parent) {
            node.parent.detachChild(node);
        }
        this.children.push(node);
        this.__own(node);
        this._domify_appendChild(node);
    },

    _domify_appendChild: function(node) {
        if (this.el) {
            this.el.appendChild(node.domify());
        }
    },

    prependChild: function(node) {
        throwIfSelfClosing(this);
        if (node.parent) {
            node.parent.detachChild(node);
        }
        this.children.unshift(node);
        this.__own(node);
        this._domify_prependChild(node);
    },

    _domify_prependChild: function(node) {
        if (this.el) {
            utils.DOMPrependChild(this.el, node.domify());
        }
    },

    insertBefore: function(node, refNode) {
        throwIfSelfClosing(this);
        var index = this.indexOf(refNode);
        if (-1 === index) {
            return; //TODO: throw?
        }
        if (node.parent) {
            node.parent.detachChild(node);
        }
        this.children.splice(index, 0, node);
        this.__own(node);
        this._domify_insertBefore(node, refNode);
    },

    _domify_insertBefore: function(node, refNode) {
        if (this.el) {
            this.el.insertBefore(node.domify(), refNode.domify());
        }
    },

    detachChild: function(node) {
        var index = this.indexOf(node);
        if (-1 === index) {
            return; //TODO: throw?
        }
        this.children.splice(index, 1);
        this.__free(node);
        this._domify_removeChild(node);
    },

    removeChild: function(node) {
        this.detachChild(node);
        node.destroy();
    },

    _domify_removeChild: function(node) {
        if (this.el) {
            this.el.removeChild(node.domify());
        }
    },

    clear: function () {
        while(this.children.length) {
            this.removeChild(this.children[0]);
        }
    },

    setText: function (text) {
        var TextNode = require('./Node/Text');
        this.clear();
        var txtNode = new TextNode();
        txtNode.setContent(text);
        this.appendChild(txtNode);
    },

    // //deprecated
    // insertAt: function(node, index) {
    //     throwIfSelfClosing(this);
    //     this.children.splice(index, 0, node);
    //     this.__own(node);
    // },

    indexOf: function(node) {
        return this.children.indexOf(node);
    },

    /**
    * listen to DOM event
    */
    listenTo: function(domEvent) {
        this._domEvents[domEvent] = true;
        this._domify_listenTo(domEvent);
    },

    unlistenTo: function(domEvent) {
        delete this._domEvents[domEvent];
        this._domify_unlistenTo(domEvent);
    },

    _domify_listenTo: function(domEvent) {
        if (this.el && bean) {
            bean.on(this.el, domEvent, this.__domEventHandler.bind(this));
        }
    },

    _domify_unlistenTo: function(domEvent) {
        if (this.el && bean) {
            bean.off(this.el, domEvent);
        }
    },

    __domEventHandler: function (e) {
        var type = e.type;
        this.emit('dom.'+type, e);
    },

    stringify: function() {
        var res = [];

        var attrs = {};
        utils.merge(attrs, this._);
        utils.merge(attrs, this._domProperties);

        res.push('<');
        res.push(esc(this.tagname));
        res.push(this.__stringifyAttrs(attrs));
        if (this.isSelfClosing()) {
            res.push(' />');
            return res.join('');
        }

        res.push('>');

        res.push(this.children.map(function(child) {
            return child.stringify();
        }).join(''));

        res.push('</' + esc(this.tagname) + '>');
        return res.join('');
    },

    domify: function() {
        if (this.el) {
            return this.el;
        }

        var el = document.createElement(this.tagname);
        this.el = el;

        Object.keys(this._).forEach(function(key) {
            var val = this._[key];
            this._domify_applyAttribute(key, val);
        }.bind(this));

        this.children.forEach(function(child) {
            this._domify_appendChild(child);
        }.bind(this));

        Object.keys(this._domEvents).forEach(function(eventName) {
            this._domify_listenTo(eventName);
        }.bind(this));

        Object.keys(this._domProperties).forEach(function(propName) {
            this._domify_setProperty(propName, this._domProperties[propName]);
        }.bind(this));

        return el;
    },

    toJSON: function() {
        var js = [];
        js.push(this.tagname);
        js.push(this._);
        js.push(this.children.map(function(child) {
            return child.toJSON();
        }));
        return js;
    },

    isSelfClosing: function() {
        return false;
    },

    isTraversable: function() {
        return true;
    },

    applyAttributeNs_class : function (attrName, value) {
        var cl = this.getAttribute('class') || '';
        if(value) {
            this.setAttribute('class', utils.addToken(cl, attrName));
        } else {
            this.setAttribute('class', utils.removeToken(cl, attrName));
        }
    },

    addClass : function (cssClass) {
        this.setAttribute('class:' + cssClass, true);
    },

    hasClass : function (cssClass) {
        var cl = this.getAttribute('class') || '';
        var map = utils.strToTokenMap(cl);
        return map.hasOwnProperty(cssClass);
    },

    toggleClass : function (cssClass) {
        this.setAttribute('class:' + cssClass, !this.hasClass(cssClass));
    },

    removeClass : function (cssClass) {
        this.setAttribute('class:' + cssClass, false);
    },

    __own: function(node) {
        if (node.parent) {
            throw new ERR.Integrity('Node not free');
        }
        node.parent = this;
    },

    __free: function(node) {
        node.parent = null;
    },

    __isAttrVisible: function (attrName) {
        return (
            0 !== attrName.indexOf('ui:') &&
            0 !== attrName.indexOf('class:')
        );
    },

    __stringifyAttrs: function (attrs) {
        //TODO properties support
        var _attrs = Object.keys(attrs)
        .filter(function (attr) {
            return this.__isAttrVisible(attr);
        }.bind(this))
        .map(function(key) {
            var val = attrs[key];
            var escaped;
            if(true === val) {
                escaped = esc(key) + '=' + '"' + esc(key) + '"';
            } else if(false === val || null === val || undefined === val) {
                escaped = false;
            } else {
                escaped = esc(key) + '=' + '"' + esc(''+val) + '"';
            }
            return escaped;
        })
        .filter(function (item) {
            return item;
        });

        if (_attrs.length) {
            _attrs.unshift('');
        }
        return _attrs.join(' ');
    },

    __destroyChildren: function () {
        this.children.forEach(function (child) {
            child.destroy();
        });
    },

    __destroyDOMEvents: function () {
        if(this._isDomified && bean) {
            bean.off(this.el);
        }
        this._domEvents = {};
    },

    __destroyEvents: function () {
        this.removeAllListeners();
    },

    __destroyElement: function () {
        //@TODO: Open issue: should DOM element be also destructed, removed from DOM tree?
        //@NOTE: WHen destroy is called, the dom element has already been removed,
        //because destroy() should be called from things like removeChild() etc.
        this.el = null;
    },

    destroy: function () {
        this.__destroyChildren();
        this.__destroyDOMEvents();
        this.__destroyEvents();
        this.__destroyElement();

        Obj.prototype.destroy.call(this);
    },

});

utils.extend(Node.prototype, EventEmitter.prototype);

function throwIfSelfClosing(node) {
    if (node.isSelfClosing()) {
        throw new ERR.NotSupported('Node is self closing');
    }
}

module.exports = Node;