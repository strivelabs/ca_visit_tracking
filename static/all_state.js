
var table;
var fileData;  //  globalish variable holding the parsed file data rows  HACK
var stateSel;
var ageGroupSel;
var essentialSel;
var states = [];
var locationTypeSel;
var locationTypes = [];
var selectedVenues;
var selectedStates;

const urlParams = new URLSearchParams(window.location.search);
var datafilename = urlParams.get('datafilename');
var maxLocationTypeLinesParam = urlParams.get('maxlocationtypes')

const MAX_LOCATIONTYPE_LINES_DEFAULT = 10;

var maxLocationTypes = MAX_LOCATIONTYPE_LINES_DEFAULT;

const ALL = "ALL";
const NONE = "NONE";

if(maxLocationTypeLinesParam) {
  maxLocationTypes = Math.max(maxLocationTypeLinesParam,1);
}

function chartTitle() {
  var result = "";
  if (stateSel.value) {
    result += stateSel.value + ", ";
  }
  if (locationTypeSel.value) {
    result += locationTypeSel.value + ", ";
  }
  switch (ageGroupSel.value) {
  case "all":
    result += "all ages, ";
    break;
  case "under65":
    result += "under 65 years old, ";
    break;
  case "over65":
    result += "over 65 years old, ";
    break;
  }
  if (!locationTypeSel.value) {
    switch (essentialSel.value) {
      case "all":
        result += "essential+non, ";
        break;
      case "essential":
        result += "essential only, ";
        break;
      case "nonessential":
        result += "non-essential only, ";
        break;
    }
  }
  result += "Visits %";
  return result;
}

function datenum(datestring) {
  var year = parseInt(datestring.slice(0, 4));
  var month = parseInt(datestring.slice(5, 7));
  var day = parseInt(datestring.slice(8, 10));
  return year * 10000 + month * 100 + day;
}

// for a given state, which locationtype lines should we show in the chart?
// let's show the top N locationtype that people were visiting on the most recent date,
// and if there aren't enough on the most recent date, then use the previous date as well,
// and so on until we have N locationtypes.
//
function locationTypesToChart(fileDataForState) {

  // sort by rank ascending,
  var sortStepOne = _.sortBy(fileDataForState, function(fileDataRow) { return fileDataRow.rank });

  // then sort by date descending,
  var sortStepTwo = _.sortBy(sortStepOne, function(fileDataRow) { return -1 * fileDataRow.datenum; });

  // then remove duplicates.
  var locationTypes = _.uniq(_.pluck(sortStepTwo, 'location_type'));

  // the top N locationtypes are then from the latest date, going back to previous dates if necessary.
  return locationTypes.slice(0, maxLocationTypes);
}

var visitIndexToShow = {
  all: 'visit_index',
  under65: 'visit_index_under65',
  over65: 'visit_index_over65'
};

function fileDataToHighcharts(fileDataToPlot) {
  return _.map(fileDataToPlot, function(fileDataRow) {
    var date = fileDataRow.date;
    var year = date.slice(0, 4);
    var month = date.slice(5, 7);
    var day = date.slice(8, 10);
    return [Date.UTC(year, month-1, day), parseInt(fileDataRow[visitIndexToShow[ageGroupSel.value]])];
  });
}

function styleSeries(series) {
  series.lineWidth = 1;
  series.marker = {radius: 5};
  return series;
}

function seriesToPlot() {
  var plotData = _.filter(fileData,
    function (datapoint) {
      var datapointEssential = datapoint.essential;
      switch (essentialSel.value) {
        case "all":
          return true;
        case "essential":
          return datapointEssential;
        case "nonessential":
          return (datapointEssential == false);
      }
    }
  );
  if (stateSel.value && !locationTypeSel.value) {
    var fileDataToPlot = _.where(plotData, { state: stateSel.value });
    var lts = locationTypesToChart(fileDataToPlot);
    var results = _.map(lts, function(locationType) {
      return styleSeries({
        name: locationType,
        data: fileDataToHighcharts(_.where(fileDataToPlot, { location_type: locationType }))
      });
    });
    results = _.filter(results, function(series) {
      return series.data.length > 0;
    });

    results.unshift({ name: 'Show/Hide All', visible: false });
    return results;
  }
  if (!stateSel.value && locationTypeSel.value) {
    var fileDataToPlot = _.where(plotData, { location_type: locationTypeSel.value });
    var results = _.map(states, function(state) {
      return styleSeries({
        name: state,
        data: fileDataToHighcharts(_.where(fileDataToPlot, { state: state }))
      });
    });
    results = _.filter(results, function(series) {
      return series.data.length > 0;
    });

    results.unshift({ name: 'Show/Hide All', visible: false });
    return results;
  }
  if (stateSel.value && locationTypeSel.value) {
    var fileDataToPlot = _.where(plotData, { location_type: locationTypeSel.value, state: stateSel.value });
    return [styleSeries({
      name: locationTypeSel.value + " in " + stateSel.value,
      data: fileDataToHighcharts(fileDataToPlot)
    })];
  }
}

function isPlotDataEmpty(seriesForPlot) {
  var plotEmpty = true;
  for(var seriesIndex = 0; seriesIndex < seriesForPlot.length; seriesIndex++){
    var series = seriesForPlot[seriesIndex];
    var seriesData = series.data;
    if(seriesData && seriesData.length > 0) {
      plotEmpty = false;
      break;
    }
  }
  return plotEmpty;
}

function drawChart() {
  var seriesForPlot = seriesToPlot();
  if (isPlotDataEmpty(seriesForPlot)) {
    // handle empty plot
    var emptyDataNotice = document.createElement("h2")
    emptyDataNotice.innerText = 'No matching data to chart';
    emptyDataNotice.style.textAlign = 'center';
    document.getElementById('chartcontainer').appendChild(emptyDataNotice);
  } else {
    Highcharts.chart('chartcontainer', {
      chart: {
        animation: false,
        events: {
          load() {
            this.showHideFlag = true;
          }
        }
      },
      responsive: {
        rules: [{
          condition: {
            maxWidth: 768
          },
          // Make the labels less space demanding on mobile
          chartOptions: {
            xAxis: {
              dateTimeLabelFormats: {
                day: '%a',
                week: '%a',
                month: '%a',
              },
              title: {
                text: ''
              }
            },
            yAxis: {
              labels: {
                align: 'left',
                x: 0,
                y: -2
              },
              title: {
                text: ''
              }
            }
          }
        }]
      },
      title: { text: chartTitle() },
      xAxis: {
        type: 'datetime',
        dateTimeLabelFormats: {
          day: '%a %b %e',
          week: '%a %b %e',
          month: '%a %b %e',
        },
        title: {
          text: 'Date'
        }
      },
      yAxis: { title: { text: 'Visits %' }, min: 0 },
      tooltip: {
        headerFormat: '<b>{series.name}</b><br>',
        pointFormat: '{point.x:%a %b %e}: {point.y}%'
      },
      plotOptions: {
        series: {
          events: {
            legendItemClick: function () {
              if (this.index == 0) {
                if (this.showHideFlag == undefined) {
                  this.showHideFlag = true
                  this.chart.series.forEach(series => {
                    series.hide()
                  })
                } else if (this.showHideFlag == true) {
                  this.chart.series.forEach(series => {
                    series.hide()
                  })
                } else {
                  this.chart.series.forEach(series => {
                    series.show()
                  })
                }
                this.showHideFlag = !this.showHideFlag;
              }
            }
          }
        }
      },
      series: seriesForPlot
    });
  }
}

function cleanLocType(string) {
  if (string == "Cafￃﾩs") {
    return "Cafes";
  }
  return string;
}


function redoFilter() {
  table.clearFilter();
  if (stateSel.value) {
    table.addFilter("state", "=", stateSel.value);
  }
  if (locationTypeSel.value) {
    table.addFilter("location_type", "=", locationTypeSel.value);
  }
  if(essentialSel.value != 'all') {
    table.addFilter("essential",'=',(essentialSel.value == 'essential'));
  }
  if (stateSel.value || locationTypeSel.value) {
    drawChart();
  }
}

function populateSelect(selectElement, stringList, selected) {
  _.each(stringList, function(theString) {
    var option = document.createElement("option");
    option.value = theString;
    option.text = theString;
    if (_.contains(selected, option.text)) {
      option.selected = true;
    }
    selectElement.add(option);
  });
}

function isGroupedCategoryEssential(groupName){
  var isGroupEssential = groupToEssentialMap.get(groupName);
  return isGroupEssential;
}

// 2020-03-01,Alabama,Shops & Services,109.0,101.0,109.0,1

function parseGroupedRow(row) {
  return {
    date: row[0],
    state: row[1],
    location_type: row[2],
    essential: isGroupedCategoryEssential(row[2]),
    visit_index: row[3],
    visit_index_over65: row[4],
    visit_index_under65: row[5],
    rank: parseInt(row[6]),
    datenum: datenum(row[0])
  };
}

// 2020-03-01,Alabama,4d4b7105d754a06378d81259,Shops & Services,108.0,102.0,109.0,1

function parseRawRow(row) {
  return {
    date: row[0],
    state: row[1],
    essential: isCategoryEssential(row[2]),
    location_type: row[3],
    visit_index: row[4],
    visit_index_over65: row[5],
    visit_index_under65: row[6],
    rank: parseInt(row[7]),
    datenum: datenum(row[0])
  };
}

function isRaw() {
  // WARNING hack
  return (datafilename.includes('raw'));
}

function parseRow(row) {
  if (isRaw()) {
    return parseRawRow(row);
  }
  return parseGroupedRow(row);
}

function parsingDone(results, file) {

  fileData = _.map(results.data.slice(1), parseRow);  // get rid of header row
  states = _.uniq(_.pluck(fileData, 'state')).sort();
  locationTypes = _.uniq(_.pluck(fileData, 'location_type')).sort();

  table = new Tabulator("#data-table", {
    data:fileData,
    columns:[
      {title:"Location Type", field:"location_type"},
      {title:"Essential", field:"essential", visible: false},
      {title:"Visits %", field:"visit_index", visible: true},
      {title:"Visits %", field:"visit_index_over65", visible: false},
      {title:"Visits %", field:"visit_index_under65", visible: false},
      {title:"State", field:"state"},
      {title:"Date", field:"date"},
    ],
    height:"600px",
    layout:"fitColumns",
    initialSort:[
      {column:"date", dir:"desc"}
    ],
  });

  stateSel = document.getElementById('state-select');
  populateSelect(stateSel, states, selectedStates);

  // TODO - probably should think about filtering the location types for grouped when there is an essential filter
  locationTypeSel = document.getElementById('location-type-select');
  populateSelect(locationTypeSel, locationTypes, selectedVenues);

  ageGroupSel = document.getElementById('agegroup-select');
  ageGroupSel.addEventListener('change', function(event) {
    // hide all 3
    table.hideColumn("visit_index");
    table.hideColumn("visit_index_over65");
    table.hideColumn("visit_index_under65");
    switch (ageGroupSel.value) {
    case "all":
      table.showColumn("visit_index");
      break;
    case "under65":
      table.showColumn("visit_index_under65");
      break;
    case "over65":
      table.showColumn("visit_index_over65");
      break;
    }


    if (stateSel.value || locationTypeSel.value) {
      drawChart();
    }
  });

  redoFilter();

  _.each([stateSel, locationTypeSel], function(sel) {
    sel.addEventListener('change', eventListener);
  });
}

var groupToEssentialMap = new Map();

var groupMappings = [
  {groupName:"Airport",essential:true},
  {groupName:"Alcohol",essential:true},
  {groupName:"Arts & Entertainment",essential:false},
  {groupName:"Banks",essential:true},
  {groupName:"Beach",essential:false},
  {groupName:"Big Box Stores",essential:false},
  {groupName:"Bus",essential:true},
  {groupName:"Colleges & Universities",essential:false},
  {groupName:"Convenience Store",essential:true},
  {groupName:"Discount Stores",essential:false},
  {groupName:"Drug Store",essential:true},
  {groupName:"Fast Food Restaurants",essential:true},
  {groupName:"Fitness Center",essential:false},
  {groupName:"Food",essential:true},
  {groupName:"Gas Stations",essential:true},
  {groupName:"Government",essential:true},
  {groupName:"Grocery",essential:true},
  {groupName:"Hardware Stores",essential:true},
  {groupName:"Hotel",essential:false},
  {groupName:"Medical",essential:true},
  {groupName:"Nightlife Spots",essential:false},
  {groupName:"Office",essential:false},
  {groupName:"Outdoors & Recreation",essential:false},
  {groupName:"Professional & Other Places",essential:false},
  {groupName:"Residences",essential:true},
  {groupName:"School",essential:false},
  {groupName:"Shops & Services",essential:false},
  {groupName:"Spiritual Center",essential:false},
  {groupName:"Sports",essential:false},
  {groupName:"Travel & Transport",essential:false},
  {groupName:"undefined",essential:false}
  ];

for (var groupIndex = 0; groupIndex < groupMappings.length; groupIndex++) {
  var nextGroup = groupMappings[groupIndex];
  groupToEssentialMap.set(nextGroup.groupName,nextGroup.essential);
}

var eventListener = function() {
  var state = stateSel.value ? encodeURIComponent(stateSel.value) : ALL
  var venue = locationTypeSel.value ? encodeURIComponent(locationTypeSel.value) : ALL;
  windowLocationToSet = "/bystatesel/" + state + "/" + venue;
  if (urlParams.get('datafilename')) {
    windowLocationToSet += "?datafilename=" + urlParams.get('datafilename');
  }
  window.location = windowLocationToSet;
};

function parseSelection() {
  selectedStates = _selectedStates == ALL ? [] : _selectedStates.split(",");
  selectedVenues = _selectedVenues == ALL ? [] : _selectedVenues.split(",");
}

function setNavLinks() {
  // TODO fix the nav links to handle the new state stuff
  document.getElementById('nav-latest').style.display = 'none';  // this is silly, and we dont have it for per-state yet
  document.getElementById('nav-chartgrouped').href = "/bydatesel/" + selectedStates + "/ALL/ALL";
  document.getElementById('nav-chartall').href = "/bydatesel/" + selectedStates + "/ALL/ALL?datafilename=raw";
  document.getElementById('nav-stategrouped').href = "/bystatesel/" + selectedStates + "/ALL";
  document.getElementById('nav-stateall').href = "/bystatesel/" + selectedStates + "/ALL?datafilename=raw";
}

essentialSel = document.getElementById('essential-select');
essentialSel.addEventListener('change', function() {
  redoFilter();
  if (stateSel.value || locationTypeSel.value) {
    drawChart();
  }
});

parseSelection();
setNavLinks();
if (!datafilename) {
  datafilename = '/data/grouped.csv';
} else {
  datafilename = '/data/' + datafilename + '.csv';
}
Papa.parse(datafilename, {download: true, complete: parsingDone});