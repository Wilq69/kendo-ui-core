(function(f, define){
    define([ "./kendo.core", "./kendo.data" ], f);
})(function(){

/* global JSZip */

var __meta__ = {
    id: "ooxml",
    name: "Excel export",
    category: "framework",
    advanced: true,
    depends: [ "data" ]
};

(function($, kendo){

kendo.ExcelExporter = kendo.Class.extend({
    init: function(options) {
        this.columns = $.map(options.columns || [], this._prepareColumn);

        this.options = options;

        var dataSource = options.dataSource;

        if (dataSource instanceof kendo.data.DataSource) {
            this.dataSource = new dataSource.constructor($.extend(
                {},
                dataSource.options,
                {
                    page: options.allPages ? 0 : dataSource.page(),
                    filter: dataSource.filter(),
                    pageSize: options.allPages ? dataSource.total() : dataSource.pageSize(),
                    sort: dataSource.sort(),
                    group: dataSource.group(),
                    aggregate: dataSource.aggregate()
                }));
        } else {
            this.dataSource = kendo.data.DataSource.create(dataSource);
        }
    },
    workbook: function() {
        var promise = this.dataSource.fetch();

        return promise.then($.proxy(function() {
            return {
                sheets: [ {
                   columns: this._columns(),
                   rows: this._rows(),
                   freezePane: this._freezePane(),
                   filter: this._filter()
                } ]
            };
        }, this));
    },
    _prepareColumn: function(column) {
        if (!column.field || column.hidden) {
            return;
        }

        return $.extend({}, column, {
            groupHeaderTemplate: kendo.template(column.groupHeaderTemplate || "${title}: ${value}"),
            groupFooterTemplate: column.groupFooterTemplate ? kendo.template(column.groupFooterTemplate) : null,
            footerTemplate: column.footerTemplate ? kendo.template(column.footerTemplate) : null
        });
    },
    _filter: function() {
        if (!this.options.filterable) {
            return null;
        }

        var depth = this._depth();

        return {
            from: depth,
            to: depth + this.columns.length - 1
        };
    },
    _dataRows: function(dataItems, level) {
        var depth = this._depth();
        var rows = $.map(dataItems, $.proxy(function(dataItem) {
            if (this._hierarchical()) {
                level = this.dataSource.level(dataItem) + 1;
            }

            var cells = $.map(new Array(level), function() {
                return {
                    background: "#dfdfdf",
                    color: "#333"
                };
            });

            // grouped
            if (depth && dataItem.items) {
                var column = $.grep(this.columns, function(column) {
                    return column.field == dataItem.field;
                })[0];

                var title = column && column.title ? column.title : dataItem.field;
                var template = column ? column.groupHeaderTemplate : null;
                var value = title + ": " + dataItem.value;
                var group = $.extend({
                        title: title,
                        field: dataItem.field,
                        value: dataItem.value,
                        aggregates: dataItem.aggregates
                    }, dataItem.aggregates[dataItem.field]);

                if (template) {
                    value = template(group);
                }

                cells.push( {
                    value: value,
                    background: "#dfdfdf",
                    color: "#333",
                    colSpan: this.columns.length + depth - level
                } );

                var rows = this._dataRows(dataItem.items, level + 1);

                rows.unshift({
                    type: "group-header",
                    cells: cells
                });

                return rows.concat(this._footer(dataItem, level+1));
            } else {
                var dataCells = $.map(this.columns, $.proxy(this._cell, this, dataItem));

                if (this._hierarchical()) {
                    dataCells[0].colSpan = depth - level + 1;
                }

                return {
                    type: "data",
                    cells: cells.concat(dataCells)
                };
            }
        }, this));

        return rows;
    },
    _footer: function(dataItem, level) {
        var rows = [];
        var footer = false;

        var cells = $.map(this.columns, function(column) {
            if (column.groupFooterTemplate) {
                footer = true;
                return {
                    background: "#dfdfdf",
                    color: "#333",
                    value: column.groupFooterTemplate(dataItem.aggregates[column.field])
                };
            } else {
                return {
                    background: "#dfdfdf",
                    color: "#333"
                };
            }
        });

        if (footer) {
            rows.push({
                type: "group-footer",
                cells: $.map(new Array(level), function() {
                    return {
                        background: "#dfdfdf",
                        color: "#333"
                    };
                }).concat(cells)
            });
        }

        return rows;
    },
    _rows: function() {
        var groups = this.dataSource.group();

        var rows = this._dataRows(this.dataSource.view(), 0);

        if (this.columns.length) {
            var headers = $.map(this.columns, function(column) {
                return {
                    background: "#7a7a7a",
                    color: "#fff",
                    value: column.title || column.field
                };
            });

            headers[0].colSpan = this._depth() + 1;

            rows.unshift({
                type: "header",
                cells: $.map(new Array(groups.length), function() {
                    return {
                        background: "#7a7a7a",
                        color: "#fff"
                    };
                }).concat(headers)
            });

            var footer = false;

            var cells = $.map(this.columns, $.proxy(function(column) {
                if (column.footerTemplate) {
                    footer = true;
                    return {
                        background: "#dfdfdf",
                        color: "#333",
                        value: column.footerTemplate(this.dataSource.aggregates()[column.field])
                    };
                } else {
                    return {
                        background: "#dfdfdf",
                        color: "#333"
                    };
                }
            }, this));

            if (footer) {
                rows.push({
                    type: "footer",
                    cells: $.map(new Array(groups.length), function() {
                        return {
                            background: "#dfdfdf",
                            color: "#333"
                        };
                    }).concat(cells)
                });
            }
        }

        return rows;
    },
    _freezePane: function() {
        var colSplit = $.grep(this.columns, function(column) {
            return column.locked;
        }).length;

        return {
            rowSplit: 1,
            colSplit: colSplit? colSplit + this.dataSource.group().length : 0
        };
    },
    _cell: function(dataItem, column) {
        if (column.field) {
            return {
                value: dataItem.get(column.field)
            };
        }
    },
    _hierarchical: function() {
        return this.options.hierarchy && this.dataSource.level;
    },
    _depth: function() {
        var dataSource = this.dataSource;
        var depth = 0;
        var view, i, level;

        if (this._hierarchical()) {
            view = dataSource.view();

            for (i = 0; i < view.length; i++) {
                level = dataSource.level(view[i]);

                if (level > depth) {
                    depth = level;
                }
            }

            depth++;
        } else {
            depth = dataSource.group().length;
        }

        return depth;
    },
    _columns: function() {
        var depth = this._depth();
        var columns = $.map(new Array(depth), function() {
            return { width: 20 };
        });

        return columns.concat($.map(this.columns, function(column) {
            return {
                width: parseInt(column.width, 10),
                autoWidth: column.width ? false : true
            };
        }));
    }
});

kendo.ExcelMixin = {
    extend: function(proto) {
       proto.events.push("excelExport");
       proto.options.excel = $.extend(proto.options.excel, this.options);
       proto.saveAsExcel = this.saveAsExcel;
    },
    options: {
        proxyURL: "",
        allPages: false,
        filterable: false,
        fileName: "Export.xlsx"
    },
    saveAsExcel: function() {
        var excel = this.options.excel || {};

        var exporter = new kendo.ExcelExporter({
            columns: this.columns,
            dataSource: this.dataSource,
            allPages: excel.allPages,
            filterable: excel.filterable,
            hierarchy: excel.hierarchy
        });

        exporter.workbook().then($.proxy(function(book) {
            if (!this.trigger("excelExport", { workbook: book })) {
                var workbook = new kendo.ooxml.Workbook(book);

                kendo.saveAs({
                    dataURI: workbook.toDataURL(),
                    fileName: book.fileName || excel.fileName,
                    proxyURL: excel.proxyURL
                });
            }
        }, this));
    }
};

})(kendo.jQuery, kendo);

return kendo;

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });
