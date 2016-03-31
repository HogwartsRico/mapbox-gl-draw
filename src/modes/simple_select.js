var {noFeature, isShiftDown, isFeature} = require('../lib/common_selectors');

module.exports = function(ctx, startingSelectedFeatureIds) {

  var selectedFeaturesById = {};
  (startingSelectedFeatureIds || []).forEach(id => {
    selectedFeaturesById[id] = ctx.store.get(id);
  });

  var startPos = null;
  var dragging = false;
  var featureCoords = null;
  var features = null;
  var numFeatures = null;

  var readyForDirectSelect = function(e) {
    if (isFeature(e)) {
      var about = e.featureTarget.properties;
      return selectedFeaturesById[about.id] !== undefined && selectedFeaturesById[about.id].type !== 'Point';
    }
    return false;
  };

  var buildFeatureCoords = function() {
    var featureIds = Object.keys(selectedFeaturesById);
    featureCoords = featureIds.map(id => selectedFeaturesById[id].getCoordinates());
    features = featureIds.map(id => selectedFeaturesById[id]);
    numFeatures = featureIds.length;
  };

  var directSelect = function(e) {
    ctx.api.changeMode('direct_select', e.featureTarget.properties.id);
  };

  return {
    start: function() {
      this.on('click', noFeature, function() {
        var wasSelected = Object.keys(selectedFeaturesById);
        selectedFeaturesById = {};
        this.fire('selected.end', wasSelected);
      });

      this.on('mousedown', isFeature, function(e) {
        dragging = true;
        startPos = e.lngLat;
        var id = e.featureTarget.properties.id;

        var isSelected = selectedFeaturesById[id] !== undefined;

        if (isSelected && !isShiftDown(e)) {
          this.on('mouseup', readyForDirectSelect, directSelect);
        }
        else if (isSelected && isShiftDown(e)) {
          delete selectedFeaturesById[id];
          this.fire('selected.end', [id]);
        }
        else if (!isSelected && isShiftDown(e)) {
          // add to selected
          selectedFeaturesById[id] = ctx.store.get(id);
          this.fire('selected.start', [id]);
        }
        else {
          //make selected
          var wasSelected = Object.keys(selectedFeaturesById);
          selectedFeaturesById = {};
          selectedFeaturesById[id] = ctx.store.get(id);
          this.fire('selected.end', wasSelected);
          this.fire('selected.start', [id]);
        }
      });

      this.on('mouseup', () => true, function() {
        dragging = false;
        featureCoords = null;
        features = null;
        numFeatures = null;
      });

      this.on('drag', () => dragging, function(e) {
        this.off('mouseup', readyForDirectSelect, directSelect);
        e.originalEvent.stopPropagation();
        if (featureCoords === null) {
          buildFeatureCoords();
        }

        var lngD = e.lngLat.lng - startPos.lng;
        var latD = e.lngLat.lat - startPos.lat;

        var coordMap = (coord) => [coord[0] + lngD, coord[1] + latD];
        var ringMap = (ring) => ring.map(coord => [coord[0] + lngD, coord[1] + latD]);

        for (var i = 0; i < numFeatures; i++) {
          var feature = features[i];
          if (feature.type === 'Point') {
            feature.coordinates[0] = featureCoords[i][0] + lngD;
            feature.coordinates[1] = featureCoords[i][1] + latD;
          }
          else if (feature.type === 'LineString') {
            feature.coordinates = featureCoords[i].map(coordMap);
          }
          else if (feature.type === 'Polygon') {
            feature.coordinates = featureCoords[i].map(ringMap);
          }
        }
      });

      this.on('trash', () => true, function() {
        dragging = false;
        featureCoords = null;
        features = null;
        numFeatures = null;
        ctx.store.delete(Object.keys(selectedFeaturesById));
        selectedFeaturesById = {};
      });
    },
    render: function(geojson, push) {
      geojson.properties.active = selectedFeaturesById[geojson.properties.id] ? 'true' : 'false';
      push(geojson);
    }
  };
};