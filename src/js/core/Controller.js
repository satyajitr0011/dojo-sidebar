define([
    'core/models/appModel',
    'core/models/layerModel',
    'core/models/widgetModel',

    'dojo/_base/array',
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/on',

    'esri/map',

    'put-selector/put',

    'widgets/Sidebar'
], function (
    appModel,
    LayerModel,
    WidgetModel,

    array,
    declare,
    lang,
    on,

    Map,

    put,

    Sidebar
) {
    return declare(null, {
        _layers: [], //temp array for layer loading
        constructor: function (config) {
            config = config || {};
            //enable debugging
            if (config.debug === true) {
                window.app = this;
                appModel.set('debug', true);
                this.model = appModel;
            }
            //start w/ the map
            this.initMap(config);
        },
        initMap: function (config) {
            //clone map config
            appModel.set('mapConfig', lang.clone(config.map));
            //create a div in the body, create an esri map in it
            var map = new Map(put(document.body, 'div.map'), config.map || {});
            //sets model's `map` property
            appModel.set('map', map);
            //appModel map on load wires up model map events
            map.on('load', lang.hitch(appModel, 'mapLoad'));
            //wait until the map is loaded before continuing to init app
            map.on('load', lang.hitch(this, 'initLayers', config, map));
        },
        initLayers: function (config, map) {
            if (config.layerInfos && config.layerInfos.length > 0) {
                //build array of layer types, require them, create layers and add to map
                var modules = [];
                array.forEach(config.layerInfos, function (layer) {
                    modules.push(layer.type);
                });
                require(modules, lang.hitch(this, function () {
                    array.forEach(config.layerInfos, function (layer, i) {
                        require([layer.type], lang.hitch(this, 'initLayer', layer, i));
                    }, this);
                    on.once(map, 'layers-add-result', lang.hitch(this, 'initUI', config, map));
                    map.addLayers(this._layers);
                }));
            } else {
                this.initUI(config, map);
            }
        },
        initLayer: function (layer, i, Layer) {
            //create layer Model
            layer = new LayerModel(layer);
            //create layer
            var l = new Layer(layer.url, layer.options);
            //pre and on load methods
            if (layer.preLoad) {
                layer.preLoad(l);
            }
            if (layer.onLoad) {
                l.on('load', lang.hitch(l, layer.onLoad));
            }
            //set as `layer` property
            layer.set('layer', l);
            //set layer info `id` property same as layer id
            layer.set('id', l.id);
            //layer model back to array at i
            appModel.layerInfos[i] = layer;
            //unshift instead of push to keep layer ordering on map intact
            this._layers.unshift(l);
        },
        initUI: function (config, map) {
            //create controls div
            appModel.mapControlsNode = put(map.root, 'div.mapControls.sidebar-map');
            //move the slider into the controls div
            put(appModel.mapControlsNode, '>', map._slider);
            //create sidebar
            appModel.sidebar = new Sidebar({
                collapseSyncNode: appModel.mapControlsNode
            }, put(map.root, 'div'));
            appModel.sidebar.startup();
            // init widgets
            this.initWidgets(config, map);
        },
        initWidgets: function (config, map) {
            if (config.widgetInfos && config.widgetInfos.length > 0) {
                //build array of widget types, require them, create widgets and add to map
                var modules = [];
                array.forEach(config.widgetInfos, function (widget) {
                    modules.push(widget.type);
                });
                require(modules, lang.hitch(this, function () {
                    array.forEach(config.widgetInfos, function (widget, i) {
                        require([widget.type], lang.hitch(this, 'initWidget', widget, i));
                    }, this);
                }));
            }
        },
        initWidget: function (widget, i, Widget) {
            //replace model properties in config if true
            if (widget.options.model === true) { //better to require 'core/models/appModel'
                widget.options.model = appModel;
            }
            if (widget.options.map === true) {
                widget.options.map = appModel.map;
            }
            if (widget.options.layerInfos === true) {
                widget.options.layerInfos = appModel.layerInfos;
            } else if (widget.options.layerInfos && widget.options.layerInfos.length) {
                //replace layer ids with layers if custom layerInfos
                array.forEach(widget.options.layerInfos, function (info) {
                    if (info.layer && appModel.map.getLayer(info.layer)) {
                        info.layer = appModel.map.getLayer(info.layer);
                    }
                }, this);
            }
            if (widget.options.widgetInfos === true) {
                widget.options.widgetInfos = appModel.widgetInfos;
            }
            //create widget model
            widget = new WidgetModel(widget);
            //default to tab
            if (!widget.get('placeAt')) {
                widget.set('placeAt', 'tab');
            }
            //create widget and place appropriately
            //var w = new Widget(widget.options); //this doesn't work with some esri widgets like Legend which require srcNodeRef when constructing :/
            var w;
            switch (widget.get('placeAt')) {
            case 'mapControls':
                w = new Widget(widget.options, put(appModel.mapControlsNode, 'div.' + (widget.get('className') || 'widget') + ' div'));
                break;
            case 'map':
                w = new Widget(widget.options, put(appModel.map.root, 'div.' + (widget.get('className') || 'widget') + ' div'));
                break;
            case 'tab':
                var tabOptions = widget.get('tabOptions') || {};
                var tab = appModel.sidebar.createTab(tabOptions);
                w = new Widget(widget.options, put(tab.containerNode, 'div'));
                break;
            case 'none':
                w = new Widget(widget.options);
                break;
            default:
                break;
            }
            //start it
            w.startup();
            //set as `widget` property
            widget.set('widget', w);
            //set widget info `id` property same as widget id
            widget.set('id', w.id);
            //widget model back to array at i
            appModel.widgetInfos[i] = widget;
        }
    });
});