/**
 * SchemaService - Centralized schema management for dynamic headers
 * Addresses Issues #002, #004, #005 - Header synchronization and management
 */
const SchemaService = {
  schemas: {
    // Use computed property names to link directly to Config
    [CONFIG.SHEET_NAME]: {
      v1: {
        timestamp: 'Timestamp',
        behaviors: '今天完成了哪些？',
        sleepStart: '昨晚實際入睡時間',
        sleepEnd: '今天實際起床時間',
        sleepPlanned: '今晚預計幾點入睡？',
        sleepQuality: '昨晚睡眠品質如何？',
        mood: '今日整體心情感受',
        energy: '今日整體精力水平如何？',
        note: '今天想記點什麼？',
        weight: '體重紀錄',
        screenTime: '今日手機螢幕使用時間',
        topApps: '今日使用最多的 App'
      }
    },
    [CONFIG.OUTPUT.DAILY_SHEET]: {
      v1: {
        timestamp: 'Report Generated',
        date: 'Date',
        analysis: 'AI Analysis',
        behaviorTotal: 'Behavior Total',
        behaviorPositive: 'Behavior Positive',
        behaviorNegative: 'Behavior Negative',
        behaviorRaw: 'Behavior Raw',
        behaviorGoal: 'Behavior Goal',
        sleepTotal: 'Sleep Total',
        sleepDuration: 'Sleep Duration',
        sleepQuality: 'Sleep Quality',
        sleepRegularity: 'Sleep Regularity',
        
        // --- [New in v2] Metadata columns for traceability ---
        behaviorScoreVersion: 'Behavior Score Version',
        sleepScoreVersion: 'Sleep Score Version'
      }
    },
    [CONFIG.OUTPUT.BEHAVIOR_SHEET]: {
      v1: {
        behavior: 'Behavior',
        score: 'Score',
        category: 'Category',
        lastUpdated: 'Last Updated'
      }
    }
  },
  
  currentVersions: {
    // Also use computed property names here and link to SCHEMA_VERSIONS in Config
    [CONFIG.SHEET_NAME]: CONFIG.SCHEMA_VERSIONS.MetaLog,
    [CONFIG.OUTPUT.DAILY_SHEET]: CONFIG.SCHEMA_VERSIONS.DailyReport,
    [CONFIG.OUTPUT.BEHAVIOR_SHEET]: CONFIG.SCHEMA_VERSIONS.BehaviorScores
  },
  
  /**
   * Get current schema for a sheet
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} Current schema mapping
   */
  getSchema(sheetName) {
    const version = this.currentVersions[sheetName];
    if (!version || !this.schemas[sheetName]) {
      throw new Error(`Schema not found for sheet: ${sheetName}`);
    }
    return this.schemas[sheetName][version];
  },
  
  /**
   * Map row data to structured object using schema
   * @param {string} sheetName - Name of the sheet
   * @param {Array} headers - Actual headers from sheet
   * @param {Array} rowData - Row data array
   * @returns {Object} Mapped data object
   */
  mapRowToObject(sheetName, headers, rowData) {
    const schema = this.getSchema(sheetName);
    const reverseSchema = this._getReverseSchema(schema);
    
    const mappedData = {};
    headers.forEach((header, index) => {
      const fieldName = reverseSchema[header.trim()];
      if (fieldName && rowData[index] !== undefined) {
        mappedData[fieldName] = rowData[index];
      }
    });
    
    return mappedData;
  },
  
  /**
   * Get headers for a sheet based on current schema
   * @param {string} sheetName - Name of the sheet
   * @returns {Array} Ordered array of headers
   */
  getHeaders(sheetName) {
    const schema = this.getSchema(sheetName);
    return Object.values(schema);
  },
  
  /**
   * Detect schema changes between sheet headers and expected schema
   * @param {string} sheetName - Name of the sheet
   * @param {Array} actualHeaders - Headers from the sheet
   * @returns {Object} Schema diff information
   */
  detectSchemaChanges(sheetName, actualHeaders) {
    const expectedHeaders = this.getHeaders(sheetName);
    const actualSet = new Set(actualHeaders.map(h => h.trim()));
    const expectedSet = new Set(expectedHeaders);
    
    return {
      missing: expectedHeaders.filter(h => !actualSet.has(h)),
      extra: actualHeaders.filter(h => !expectedSet.has(h.trim())),
      hasChanges: actualSet.size !== expectedSet.size || 
                  [...actualSet].some(h => !expectedSet.has(h))
    };
  },
  
  /**
   * Add a new field to schema (for extensibility)
   * @param {string} sheetName - Name of the sheet
   * @param {string} fieldName - Internal field name
   * @param {string} headerName - Display header name
   * @param {string} newVersion - New version identifier
   */
  addField(sheetName, fieldName, headerName, newVersion) {
    if (!this.schemas[sheetName]) {
      throw new Error(`Sheet schema not found: ${sheetName}`);
    }
    
    // Create new version based on current
    const currentVersion = this.currentVersions[sheetName];
    const currentSchema = this.schemas[sheetName][currentVersion];
    
    this.schemas[sheetName][newVersion] = {
      ...currentSchema,
      [fieldName]: headerName
    };
    
    console.log(`[SchemaService] Added field '${fieldName}' to ${sheetName} schema version ${newVersion}`);
    
    // Emit event for schema change
    if (typeof EventBus !== 'undefined') {
      EventBus.emit('SCHEMA_UPDATED', {
        sheet: sheetName,
        oldVersion: currentVersion,
        newVersion: newVersion,
        change: { added: fieldName }
      });
    }
  },
  
  /**
   * Update schema version for a sheet
   * @param {string} sheetName - Name of the sheet
   * @param {string} version - Version to use
   */
  setVersion(sheetName, version) {
    if (!this.schemas[sheetName] || !this.schemas[sheetName][version]) {
      throw new Error(`Schema version ${version} not found for sheet: ${sheetName}`);
    }
    
    const oldVersion = this.currentVersions[sheetName];
    this.currentVersions[sheetName] = version;
    
    console.log(`[SchemaService] Updated ${sheetName} schema from ${oldVersion} to ${version}`);
  },
  
  /**
   * Get field name by header value
   * @private
   */
  _getReverseSchema(schema) {
    if (!schema) return {}; // Add a guard clause for safety
    const reverse = {};
    Object.entries(schema).forEach(([field, header]) => {
      reverse[header] = field;
    });
    return reverse;
  }
}; 