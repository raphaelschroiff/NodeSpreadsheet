(function(exports) {

    /**
     * creates a row object that can be inserted into a sheetDoc
     * 
     * @param{Number} [col_count the number of columns that the row should have]
     */
    exports.createRowObject = function(col_count) {
        var cols = [],
			col_info = [];
            
        col_count = col_count || 5;

		for (var col = 0; col < col_count; col++) {
			cols.push({
				value: "",
				style: {
                    flags: {}
                }
			});
			col_info.push({
				size: 120
			});
		}
        
        return cols;
    };
    
    /**
     * creates a sheet object that can be inserted into a sheetDoc
     * 
     * @param{Number} [row_count the number of rows that the sheet should have]
     * @param{Number} [col_count the number of columns that the sheet should have]
     */
	exports.createSheetObject = function(row_count, col_count) {
        var cols,
			col_info = [],
			rows = [];

		row_count = row_count || 15;            
        col_count = col_count || 5;
        
        cols = exports.createRowObject(col_count);

		for (var col = 0; col < col_count; col++) {
			col_info.push({
				size: 120
			});
		}
        
		for (var row = 0; row < row_count; row++) {
			rows.push({
				'cells': cols,
				size: 20
			});
		}
        
        return {
            'rows': rows,
            'columns': col_info
        };
	};

    /**
     * creates a object that represents a new (empty) spreadsheet document
     * 
     * @param{Number} [sheet_count the number of sheets that the new document should have]
     */
	exports.createShareDoc = function(sheet_count) {
		var new_sheet = exports.createSheetObject(),
            sheets = [];

        sheet_count = sheet_count || 1;
        
        for (var sheet = 0; sheet < sheet_count; sheet++) {
            sheets.push(new_sheet);
		}

		return {
			'sheets': sheets,
            'users': {}
		};
	};

})(typeof exports === 'undefined' ? this['sheetDocHelper'] = {} : exports);