'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import styles from './PaintCalculator.module.css';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const UNIT_SYSTEMS = {
  imperial: {
    name: 'Imperial',
    length: 'ft',
    smallLength: 'in',
    area: 'sq ft',
    volume: 'gallon',
    volumeAbbr: 'gal',
    conversionToMetric: 0.3048,
    areaConversion: 0.092903,
  },
  metric: {
    name: 'Metric',
    length: 'm',
    smallLength: 'cm',
    area: 'sq m',
    volume: 'litre',
    volumeAbbr: 'L',
    conversionToMetric: 1,
    areaConversion: 1,
  },
};

const OPENING_TYPES = {
  prefinishedDoor: {
    label: 'Pre-finished Door',
    description: 'Ready-made door (not painted) — area subtracted from walls',
    action: 'subtract',
    defaultWidth: 3,
    defaultHeight: 7,
    faces: 0,
  },
  paintableDoor: {
    label: 'Paintable Door',
    description: 'Wooden/metal door requiring enamel paint — area added',
    action: 'add',
    defaultWidth: 3,
    defaultHeight: 7,
    faces: 2,
  },
  window: {
    label: 'Window',
    description: 'Standard window — area subtracted from walls',
    action: 'subtract',
    defaultWidth: 4,
    defaultHeight: 3,
    faces: 0,
  },
  slidingDoor: {
    label: 'Sliding Door',
    description: 'Glass sliding door — configurable treatment',
    action: 'subtract',
    defaultWidth: 6,
    defaultHeight: 7,
    faces: 0,
  },
  wardrobe: {
    label: 'Built-in Wardrobe',
    description: 'Built-in storage — configurable (paint or skip)',
    action: 'add',
    defaultWidth: 6,
    defaultHeight: 8,
    faces: 1,
  },
  grill: {
    label: 'Grill/Gate',
    description: 'Metal grill or gate — configurable treatment',
    action: 'add',
    defaultWidth: 3,
    defaultHeight: 7,
    faces: 2,
  },
};

const PAINT_TYPES = {
  interior: {
    label: 'Interior Wall Paint',
    coverage: { imperial: 350, metric: 32.5 },
    description: 'Standard interior latex/emulsion',
  },
  exterior: {
    label: 'Exterior Paint',
    coverage: { imperial: 300, metric: 28 },
    description: 'Weather-resistant exterior paint',
  },
  enamel: {
    label: 'Enamel Paint',
    coverage: { imperial: 400, metric: 37 },
    description: 'For doors, trim, and metal surfaces',
  },
  primer: {
    label: 'Primer',
    coverage: { imperial: 400, metric: 37 },
    description: 'Base coat for better adhesion',
  },
  ceiling: {
    label: 'Ceiling Paint',
    coverage: { imperial: 400, metric: 37 },
    description: 'Flat finish for ceilings',
  },
};

const DEFAULT_SETTINGS = {
  coats: 2,
  wastagePercent: 10,
  includeCeiling: true,
  paintType: 'interior',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const CalculationEngine = {
  convertLength(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    const toMetric = fromUnit === 'imperial' ? value * 0.3048 : value;
    return toUnit === 'imperial' ? toMetric / 0.3048 : toMetric;
  },

  convertArea(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    const toMetric = fromUnit === 'imperial' ? value * 0.092903 : value;
    return toUnit === 'imperial' ? toMetric / 0.092903 : toMetric;
  },

  calculateWallArea(length, width, height) {
    const perimeter = 2 * (parseFloat(length) + parseFloat(width));
    return perimeter * parseFloat(height);
  },

  calculateCeilingArea(length, width) {
    return parseFloat(length) * parseFloat(width);
  },

  calculateOpeningArea(opening) {
    const baseArea = parseFloat(opening.width) * parseFloat(opening.height);
    const quantity = parseInt(opening.quantity) || 1;
    const faces = opening.customFaces ?? OPENING_TYPES[opening.type]?.faces ?? 0;
    
    if (opening.action === 'add') {
      return baseArea * quantity * Math.max(faces, 1);
    }
    return baseArea * quantity;
  },

  calculateRoomArea(room, includeCeiling) {
    const wallArea = this.calculateWallArea(room.length, room.width, room.height);
    const ceilingArea = includeCeiling ? this.calculateCeilingArea(room.length, room.width) : 0;
    
    let subtractArea = 0;
    let addArea = 0;
    
    room.openings.forEach(opening => {
      const area = this.calculateOpeningArea(opening);
      if (opening.action === 'subtract') {
        subtractArea += area;
      } else if (opening.action === 'add') {
        addArea += area;
      }
    });
    
    return {
      wallArea,
      ceilingArea,
      subtractArea,
      addArea,
      netWallArea: Math.max(0, wallArea - subtractArea),
      totalPaintableArea: Math.max(0, wallArea - subtractArea) + ceilingArea + addArea,
    };
  },

  calculatePaintRequired(area, coverage, coats, wastagePercent) {
    const baseAmount = area / coverage;
    const withCoats = baseAmount * coats;
    const withWastage = withCoats * (1 + wastagePercent / 100);
    return {
      base: baseAmount,
      withCoats,
      withWastage,
      rounded: Math.ceil(withWastage),
    };
  },

  calculateAll(rooms, settings, unitSystem) {
    const results = {
      rooms: [],
      totals: {
        wallArea: 0,
        ceilingArea: 0,
        subtractArea: 0,
        addArea: 0,
        netWallArea: 0,
        totalPaintableArea: 0,
      },
      paint: null,
    };

    rooms.forEach(room => {
      const roomCalc = this.calculateRoomArea(room, settings.includeCeiling);
      results.rooms.push({
        ...room,
        calculations: roomCalc,
      });
      
      Object.keys(results.totals).forEach(key => {
        results.totals[key] += roomCalc[key];
      });
    });

    const paintConfig = PAINT_TYPES[settings.paintType];
    const coverage = paintConfig.coverage[unitSystem];
    
    results.paint = this.calculatePaintRequired(
      results.totals.totalPaintableArea,
      coverage,
      settings.coats,
      settings.wastagePercent
    );

    results.settings = settings;
    results.unitSystem = unitSystem;
    results.coverage = coverage;

    return results;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const ExportUtils = {
  toJSON(results) {
    return JSON.stringify(results, null, 2);
  },

  toCSV(results) {
    const units = UNIT_SYSTEMS[results.unitSystem];
    let csv = 'Paint Calculator Estimate\n\n';
    
    csv += 'Room Details\n';
    csv += 'Room Name,Wall Area,Ceiling Area,Subtract Area,Add Area,Net Paintable Area\n';
    
    results.rooms.forEach(room => {
      const c = room.calculations;
      csv += `"${room.name}",${c.wallArea.toFixed(2)},${c.ceilingArea.toFixed(2)},${c.subtractArea.toFixed(2)},${c.addArea.toFixed(2)},${c.totalPaintableArea.toFixed(2)}\n`;
    });
    
    csv += '\nTotals\n';
    csv += `Total Wall Area,${results.totals.wallArea.toFixed(2)} ${units.area}\n`;
    csv += `Total Ceiling Area,${results.totals.ceilingArea.toFixed(2)} ${units.area}\n`;
    csv += `Total Subtract Area,${results.totals.subtractArea.toFixed(2)} ${units.area}\n`;
    csv += `Total Add Area,${results.totals.addArea.toFixed(2)} ${units.area}\n`;
    csv += `Net Paintable Area,${results.totals.totalPaintableArea.toFixed(2)} ${units.area}\n`;
    
    csv += '\nPaint Required\n';
    csv += `Coats,${results.settings.coats}\n`;
    csv += `Wastage,${results.settings.wastagePercent}%\n`;
    csv += `Coverage,${results.coverage} ${units.area}/${units.volumeAbbr}\n`;
    csv += `Paint Required,${results.paint.withWastage.toFixed(2)} ${units.volumeAbbr}\n`;
    csv += `Recommended Purchase,${results.paint.rounded} ${units.volumeAbbr}\n`;
    
    return csv;
  },

  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const Icons = {
  Paint: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/>
      <path d="M3 9h18"/>
      <path d="M9 21V9"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Download: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Printer: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
    </svg>
  ),
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Info: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLTIP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Tooltip = ({ content }) => (
  <span className={styles.tooltipTrigger} tabIndex="0" role="button" aria-label={content}>
    ?
    <span className={styles.tooltip} role="tooltip">{content}</span>
  </span>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Modal = ({ isOpen, onClose, title, children, footer }) => {
  const modalRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusableElements?.[0]?.focus();
      
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={styles.modal} ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="modal-title">{title}</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close modal">
            <Icons.X />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM FORM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const RoomForm = ({ room, unitSystem, onUpdate, onDelete, onAddOpening }) => {
  const units = UNIT_SYSTEMS[unitSystem];
  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      return 'Must be a positive number';
    }
    return null;
  };

  const handleChange = (field, value) => {
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
    onUpdate(room.id, { [field]: value });
  };

  const roomCalc = useMemo(() => {
    return CalculationEngine.calculateRoomArea(room, true);
  }, [room]);

  return (
    <div className={styles.roomCard} role="region" aria-label={`Room: ${room.name}`}>
      <div className={styles.roomCardHeader}>
        <div>
          <input
            type="text"
            className={styles.roomNameInput}
            value={room.name}
            onChange={(e) => onUpdate(room.id, { name: e.target.value })}
            placeholder="Room name"
            aria-label="Room name"
          />
          <span className={styles.roomCardBadge}>
            {roomCalc.totalPaintableArea.toFixed(1)} {units.area}
          </span>
        </div>
        <div className={styles.roomCardActions}>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            onClick={() => onAddOpening(room.id)}
            aria-label="Add opening to room"
          >
            <Icons.Plus /> Opening
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger} ${styles.btnIcon}`}
            onClick={() => onDelete(room.id)}
            aria-label="Delete room"
          >
            <Icons.Trash />
          </button>
        </div>
      </div>

      <div className={`${styles.formRow} ${styles.formRow3}`}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor={`length-${room.id}`}>Length</label>
          <div className={styles.inputGroup}>
            <input
              type="number"
              id={`length-${room.id}`}
              className={`${styles.input} ${errors.length ? styles.inputError : ''}`}
              value={room.length}
              onChange={(e) => handleChange('length', e.target.value)}
              min="0"
              step="0.1"
              aria-describedby={errors.length ? `length-error-${room.id}` : undefined}
            />
            <span className={styles.inputSuffix}>{units.length}</span>
          </div>
          {errors.length && (
            <span className={styles.validationMsg} id={`length-error-${room.id}`} role="alert">
              {errors.length}
            </span>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor={`width-${room.id}`}>Width</label>
          <div className={styles.inputGroup}>
            <input
              type="number"
              id={`width-${room.id}`}
              className={`${styles.input} ${errors.width ? styles.inputError : ''}`}
              value={room.width}
              onChange={(e) => handleChange('width', e.target.value)}
              min="0"
              step="0.1"
              aria-describedby={errors.width ? `width-error-${room.id}` : undefined}
            />
            <span className={styles.inputSuffix}>{units.length}</span>
          </div>
          {errors.width && (
            <span className={styles.validationMsg} id={`width-error-${room.id}`} role="alert">
              {errors.width}
            </span>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor={`height-${room.id}`}>Height</label>
          <div className={styles.inputGroup}>
            <input
              type="number"
              id={`height-${room.id}`}
              className={`${styles.input} ${errors.height ? styles.inputError : ''}`}
              value={room.height}
              onChange={(e) => handleChange('height', e.target.value)}
              min="0"
              step="0.1"
              aria-describedby={errors.height ? `height-error-${room.id}` : undefined}
            />
            <span className={styles.inputSuffix}>{units.length}</span>
          </div>
          {errors.height && (
            <span className={styles.validationMsg} id={`height-error-${room.id}`} role="alert">
              {errors.height}
            </span>
          )}
        </div>
      </div>

      {room.openings.length > 0 && (
        <div className={styles.openingsSection}>
          <span className={styles.label}>Openings</span>
          <div className={styles.openingsList}>
            {room.openings.map((opening, index) => (
              <span
                key={index}
                className={`${styles.openingTag} ${opening.action === 'subtract' ? styles.openingTagSubtract : styles.openingTagAdd}`}
              >
                <span>
                  {OPENING_TYPES[opening.type]?.label || opening.type}
                  {opening.quantity > 1 && ` ×${opening.quantity}`}
                </span>
                <span className={styles.openingTagArea}>
                  {(parseFloat(opening.width) * parseFloat(opening.height) * (opening.quantity || 1)).toFixed(1)} {units.area}
                </span>
                <button
                  className={styles.openingTagRemove}
                  onClick={() => {
                    const newOpenings = room.openings.filter((_, i) => i !== index);
                    onUpdate(room.id, { openings: newOpenings });
                  }}
                  aria-label={`Remove ${OPENING_TYPES[opening.type]?.label}`}
                >
                  <Icons.X />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADD OPENING MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const AddOpeningModal = ({ isOpen, onClose, onAdd, unitSystem }) => {
  const units = UNIT_SYSTEMS[unitSystem];
  const [opening, setOpening] = useState({
    type: 'prefinishedDoor',
    width: OPENING_TYPES.prefinishedDoor.defaultWidth,
    height: OPENING_TYPES.prefinishedDoor.defaultHeight,
    quantity: 1,
    action: OPENING_TYPES.prefinishedDoor.action,
    customFaces: OPENING_TYPES.prefinishedDoor.faces,
  });

  const handleTypeChange = (type) => {
    const config = OPENING_TYPES[type];
    setOpening({
      ...opening,
      type,
      width: config.defaultWidth,
      height: config.defaultHeight,
      action: config.action,
      customFaces: config.faces,
    });
  };

  const handleSubmit = () => {
    onAdd(opening);
    onClose();
    setOpening({
      type: 'prefinishedDoor',
      width: OPENING_TYPES.prefinishedDoor.defaultWidth,
      height: OPENING_TYPES.prefinishedDoor.defaultHeight,
      quantity: 1,
      action: OPENING_TYPES.prefinishedDoor.action,
      customFaces: OPENING_TYPES.prefinishedDoor.faces,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Opening"
      footer={
        <>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>Add Opening</button>
        </>
      }
    >
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="opening-type">Type</label>
        <select
          id="opening-type"
          className={`${styles.input} ${styles.select}`}
          value={opening.type}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {Object.entries(OPENING_TYPES).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <p className={styles.fieldDescription}>
          {OPENING_TYPES[opening.type].description}
        </p>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="opening-width">Width</label>
          <div className={styles.inputGroup}>
            <input
              type="number"
              id="opening-width"
              className={styles.input}
              value={opening.width}
              onChange={(e) => setOpening({ ...opening, width: e.target.value })}
              min="0"
              step="0.1"
            />
            <span className={styles.inputSuffix}>{units.length}</span>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="opening-height">Height</label>
          <div className={styles.inputGroup}>
            <input
              type="number"
              id="opening-height"
              className={styles.input}
              value={opening.height}
              onChange={(e) => setOpening({ ...opening, height: e.target.value })}
              min="0"
              step="0.1"
            />
            <span className={styles.inputSuffix}>{units.length}</span>
          </div>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="opening-quantity">Quantity</label>
          <input
            type="number"
            id="opening-quantity"
            className={styles.input}
            value={opening.quantity}
            onChange={(e) => setOpening({ ...opening, quantity: parseInt(e.target.value) || 1 })}
            min="1"
            step="1"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={`${styles.label} ${styles.labelWithTooltip}`} htmlFor="opening-action">
            Treatment
            <Tooltip content="Subtract: area removed from walls. Add: area added to paint total (e.g., paintable doors)." />
          </label>
          <select
            id="opening-action"
            className={`${styles.input} ${styles.select}`}
            value={opening.action}
            onChange={(e) => setOpening({ ...opening, action: e.target.value })}
          >
            <option value="subtract">Subtract from walls</option>
            <option value="add">Add to paint area</option>
          </select>
        </div>
      </div>

      {opening.action === 'add' && (
        <div className={styles.formGroup}>
          <label className={`${styles.label} ${styles.labelWithTooltip}`} htmlFor="opening-faces">
            Faces to paint
            <Tooltip content="Number of surfaces to paint. E.g., 2 for both sides of a door." />
          </label>
          <input
            type="number"
            id="opening-faces"
            className={styles.input}
            value={opening.customFaces}
            onChange={(e) => setOpening({ ...opening, customFaces: parseInt(e.target.value) || 1 })}
            min="1"
            max="4"
            step="1"
          />
        </div>
      )}
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const SettingsPanel = ({ settings, onUpdate, unitSystem }) => {
  const units = UNIT_SYSTEMS[unitSystem];
  const paintConfig = PAINT_TYPES[settings.paintType];

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <span className={`${styles.cardTitleIcon} ${styles.cardTitleIconOrange}`}>
            <Icons.Settings />
          </span>
          Paint Settings
        </h2>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="paint-type">Paint Type</label>
        <select
          id="paint-type"
          className={`${styles.input} ${styles.select}`}
          value={settings.paintType}
          onChange={(e) => onUpdate({ paintType: e.target.value })}
        >
          {Object.entries(PAINT_TYPES).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <p className={styles.fieldDescription}>
          {paintConfig.description} — Coverage: {paintConfig.coverage[unitSystem]} {units.area}/{units.volumeAbbr}
        </p>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={`${styles.label} ${styles.labelWithTooltip}`} htmlFor="coats">
            Coats
            <Tooltip content="Number of paint coats to apply. 2 coats is standard for best coverage." />
          </label>
          <input
            type="number"
            id="coats"
            className={styles.input}
            value={settings.coats}
            onChange={(e) => onUpdate({ coats: parseInt(e.target.value) || 1 })}
            min="1"
            max="4"
            step="1"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={`${styles.label} ${styles.labelWithTooltip}`} htmlFor="wastage">
            Wastage %
            <Tooltip content="Extra paint for spills, touch-ups, and uneven surfaces. 10% is typical." />
          </label>
          <div className={styles.inputGroup}>
            <input
              type="number"
              id="wastage"
              className={styles.input}
              value={settings.wastagePercent}
              onChange={(e) => onUpdate({ wastagePercent: parseInt(e.target.value) || 0 })}
              min="0"
              max="50"
              step="5"
            />
            <span className={styles.inputSuffix}>%</span>
          </div>
        </div>
      </div>

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={settings.includeCeiling}
          onChange={(e) => onUpdate({ includeCeiling: e.target.checked })}
        />
        Include ceiling area
      </label>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const ResultsPanel = ({ results }) => {
  if (!results || results.rooms.length === 0) {
    return (
      <div className={`${styles.results} ${styles.resultsEmpty}`}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>
            <Icons.Paint />
          </div>
          <h3 className={styles.emptyStateTitle}>No rooms added</h3>
          <p className={styles.emptyStateText}>Add a room to see paint calculations</p>
        </div>
      </div>
    );
  }

  const units = UNIT_SYSTEMS[results.unitSystem];

  const handleExportCSV = () => {
    const csv = ExportUtils.toCSV(results);
    ExportUtils.downloadFile(csv, 'paint-estimate.csv', 'text/csv');
  };

  const handleExportJSON = () => {
    const json = ExportUtils.toJSON(results);
    ExportUtils.downloadFile(json, 'paint-estimate.json', 'application/json');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.results} role="region" aria-label="Paint calculation results">
      <div className={styles.resultsHeader}>
        <h2 className={styles.resultsTitle}>Estimate</h2>
      </div>

      <div className={styles.resultsMain}>
        <div className={`${styles.resultsStat} ${styles.resultsStatHighlight}`}>
          <div className={styles.resultsStatValue}>{results.paint.rounded}</div>
          <div className={styles.resultsStatLabel}>{units.volume}s needed</div>
        </div>
        <div className={styles.resultsStat}>
          <div className={styles.resultsStatValue}>{results.totals.totalPaintableArea.toFixed(0)}</div>
          <div className={styles.resultsStatLabel}>{units.area} total</div>
        </div>
        <div className={styles.resultsStat}>
          <div className={styles.resultsStatValue}>{results.rooms.length}</div>
          <div className={styles.resultsStatLabel}>room{results.rooms.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className={styles.resultsBreakdown}>
        <h3 className={styles.resultsBreakdownTitle}>Area Breakdown</h3>
        <div className={styles.resultsBreakdownRow}>
          <span className={styles.resultsBreakdownLabel}>Wall area</span>
          <span className={styles.resultsBreakdownValue}>{results.totals.wallArea.toFixed(1)} {units.area}</span>
        </div>
        {results.settings.includeCeiling && (
          <div className={styles.resultsBreakdownRow}>
            <span className={styles.resultsBreakdownLabel}>Ceiling area</span>
            <span className={styles.resultsBreakdownValue}>{results.totals.ceilingArea.toFixed(1)} {units.area}</span>
          </div>
        )}
        {results.totals.subtractArea > 0 && (
          <div className={styles.resultsBreakdownRow}>
            <span className={styles.resultsBreakdownLabel}>Openings (subtract)</span>
            <span className={`${styles.resultsBreakdownValue} ${styles.resultsBreakdownValueSubtract}`}>
              −{results.totals.subtractArea.toFixed(1)} {units.area}
            </span>
          </div>
        )}
        {results.totals.addArea > 0 && (
          <div className={styles.resultsBreakdownRow}>
            <span className={styles.resultsBreakdownLabel}>Paintable items (add)</span>
            <span className={`${styles.resultsBreakdownValue} ${styles.resultsBreakdownValueAdd}`}>
              +{results.totals.addArea.toFixed(1)} {units.area}
            </span>
          </div>
        )}
        <div className={`${styles.resultsBreakdownRow} ${styles.resultsBreakdownRowTotal}`}>
          <span className={`${styles.resultsBreakdownLabel} ${styles.resultsBreakdownLabelBold}`}>Net paintable area</span>
          <span className={`${styles.resultsBreakdownValue} ${styles.resultsBreakdownValueBold}`}>{results.totals.totalPaintableArea.toFixed(1)} {units.area}</span>
        </div>
      </div>

      <div className={styles.resultsBreakdown}>
        <h3 className={styles.resultsBreakdownTitle}>Paint Calculation</h3>
        <div className={styles.resultsBreakdownRow}>
          <span className={styles.resultsBreakdownLabel}>Base paint needed</span>
          <span className={styles.resultsBreakdownValue}>{results.paint.base.toFixed(2)} {units.volumeAbbr}</span>
        </div>
        <div className={styles.resultsBreakdownRow}>
          <span className={styles.resultsBreakdownLabel}>× {results.settings.coats} coats</span>
          <span className={styles.resultsBreakdownValue}>{results.paint.withCoats.toFixed(2)} {units.volumeAbbr}</span>
        </div>
        <div className={styles.resultsBreakdownRow}>
          <span className={styles.resultsBreakdownLabel}>+ {results.settings.wastagePercent}% wastage</span>
          <span className={styles.resultsBreakdownValue}>{results.paint.withWastage.toFixed(2)} {units.volumeAbbr}</span>
        </div>
        <div className={`${styles.resultsBreakdownRow} ${styles.resultsBreakdownRowTotal}`}>
          <span className={`${styles.resultsBreakdownLabel} ${styles.resultsBreakdownLabelBold}`}>Recommended purchase</span>
          <span className={`${styles.resultsBreakdownValue} ${styles.resultsBreakdownValueBold} ${styles.resultsBreakdownValueLarge}`}>{results.paint.rounded} {units.volume}s</span>
        </div>
      </div>

      <details className={styles.detailsSection}>
        <summary className={styles.detailsSummary}>
          View per-room breakdown
        </summary>
        <div className={`${styles.resultsBreakdown} ${styles.resultsBreakdownNested}`}>
          {results.rooms.map((room, index) => (
            <div key={index} className={styles.resultsBreakdownRow}>
              <span className={styles.resultsBreakdownLabel}>{room.name}</span>
              <span className={styles.resultsBreakdownValue}>{room.calculations.totalPaintableArea.toFixed(1)} {units.area}</span>
            </div>
          ))}
        </div>
      </details>

      <div className={styles.resultsActions}>
        <button className={styles.resultsBtn} onClick={handleExportCSV} aria-label="Download CSV">
          <Icons.Download /> CSV
        </button>
        <button className={styles.resultsBtn} onClick={handleExportJSON} aria-label="Download JSON">
          <Icons.Download /> JSON
        </button>
        <button className={styles.resultsBtn} onClick={handlePrint} aria-label="Print estimate">
          <Icons.Printer /> Print
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE CALCULATIONS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const ExamplePanel = ({ onLoadExample }) => {
  const exampleData = {
    rooms: [
      {
        id: '1',
        name: 'Living Room',
        length: 20,
        width: 15,
        height: 9,
        openings: [
          { type: 'prefinishedDoor', width: 3, height: 7, quantity: 1, action: 'subtract' },
          { type: 'window', width: 6, height: 4, quantity: 2, action: 'subtract' },
        ],
      },
      {
        id: '2',
        name: 'Master Bedroom',
        length: 14,
        width: 12,
        height: 9,
        openings: [
          { type: 'paintableDoor', width: 3, height: 7, quantity: 1, action: 'add', customFaces: 2 },
          { type: 'window', width: 4, height: 3, quantity: 1, action: 'subtract' },
          { type: 'wardrobe', width: 8, height: 8, quantity: 1, action: 'add', customFaces: 1 },
        ],
      },
    ],
    settings: {
      coats: 2,
      wastagePercent: 10,
      includeCeiling: true,
      paintType: 'interior',
    },
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <span className={`${styles.cardTitleIcon} ${styles.cardTitleIconPurple}`}>
            <Icons.Info />
          </span>
          Example Calculation
        </h2>
      </div>

      <div className={styles.exampleContent}>
        <p className={styles.exampleParagraph}>
          <strong>Living Room (20×15×9 ft):</strong><br />
          Wall area = 2(20+15) × 9 = 630 sq ft<br />
          Ceiling = 20 × 15 = 300 sq ft<br />
          Door (3×7) = −21 sq ft<br />
          2 Windows (6×4) = −48 sq ft<br />
          <strong>Net: 861 sq ft</strong>
        </p>
        <p className={styles.exampleParagraph}>
          <strong>Master Bedroom (14×12×9 ft):</strong><br />
          Wall area = 2(14+12) × 9 = 468 sq ft<br />
          Ceiling = 14 × 12 = 168 sq ft<br />
          Paintable door (3×7×2 faces) = +42 sq ft<br />
          Window (4×3) = −12 sq ft<br />
          Wardrobe (8×8×1 face) = +64 sq ft<br />
          <strong>Net: 730 sq ft</strong>
        </p>
        <p>
          <strong>Total: 1,591 sq ft</strong><br />
          At 350 sq ft/gal coverage, 2 coats, 10% wastage:<br />
          (1591 ÷ 350) × 2 × 1.1 = <strong>~11 gallons</strong>
        </p>
      </div>

      <button
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFullWidth}`}
        onClick={() => onLoadExample(exampleData)}
      >
        Load This Example
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APPLICATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PaintCalculator() {
  const [unitSystem, setUnitSystem] = useState('imperial');
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [openingModalState, setOpeningModalState] = useState({ isOpen: false, roomId: null });

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addRoom = useCallback(() => {
    const newRoom = {
      id: generateId(),
      name: `Room ${rooms.length + 1}`,
      length: unitSystem === 'imperial' ? 12 : 4,
      width: unitSystem === 'imperial' ? 10 : 3,
      height: unitSystem === 'imperial' ? 9 : 2.7,
      openings: [],
    };
    setRooms([...rooms, newRoom]);
  }, [rooms, unitSystem]);

  const updateRoom = useCallback((roomId, updates) => {
    setRooms(rooms.map(room =>
      room.id === roomId ? { ...room, ...updates } : room
    ));
  }, [rooms]);

  const deleteRoom = useCallback((roomId) => {
    setRooms(rooms.filter(room => room.id !== roomId));
  }, [rooms]);

  const addOpening = useCallback((opening) => {
    const roomId = openingModalState.roomId;
    setRooms(rooms.map(room =>
      room.id === roomId
        ? { ...room, openings: [...room.openings, opening] }
        : room
    ));
  }, [rooms, openingModalState.roomId]);

  const updateSettings = useCallback((updates) => {
    setSettings({ ...settings, ...updates });
  }, [settings]);

  const loadExample = useCallback((data) => {
    setRooms(data.rooms);
    setSettings(data.settings);
    setUnitSystem('imperial');
  }, []);

  const handleUnitChange = useCallback((newUnit) => {
    if (newUnit === unitSystem) return;

    const convertedRooms = rooms.map(room => {
      const factor = newUnit === 'metric' ? 0.3048 : 3.28084;
      return {
        ...room,
        length: (parseFloat(room.length) * factor).toFixed(2),
        width: (parseFloat(room.width) * factor).toFixed(2),
        height: (parseFloat(room.height) * factor).toFixed(2),
        openings: room.openings.map(opening => ({
          ...opening,
          width: (parseFloat(opening.width) * factor).toFixed(2),
          height: (parseFloat(opening.height) * factor).toFixed(2),
        })),
      };
    });

    setRooms(convertedRooms);
    setUnitSystem(newUnit);
  }, [rooms, unitSystem]);

  const results = useMemo(() => {
    if (rooms.length === 0) return null;
    return CalculationEngine.calculateAll(rooms, settings, unitSystem);
  }, [rooms, settings, unitSystem]);

  return (
    <div className={styles.paintCalc}>
      <header className={styles.header}>
        <div className={styles.headerIcon}>
          <Icons.Paint />
        </div>
        <h1 className={styles.headerTitle}>Paint Calculator</h1>
        <p className={styles.headerSubtitle}>Calculate exactly how much paint you need</p>
      </header>

      <div className={styles.unitToggleWrapper}>
        <div className={styles.unitToggle} role="radiogroup" aria-label="Unit system">
          <button
            className={`${styles.unitToggleBtn} ${unitSystem === 'imperial' ? styles.unitToggleBtnActive : ''}`}
            onClick={() => handleUnitChange('imperial')}
            role="radio"
            aria-checked={unitSystem === 'imperial'}
          >
            Imperial (ft)
          </button>
          <button
            className={`${styles.unitToggleBtn} ${unitSystem === 'metric' ? styles.unitToggleBtnActive : ''}`}
            onClick={() => handleUnitChange('metric')}
            role="radio"
            aria-checked={unitSystem === 'metric'}
          >
            Metric (m)
          </button>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        <main>
          <div className={`${styles.card} ${styles.cardElevated}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span className={`${styles.cardTitleIcon} ${styles.cardTitleIconBlue}`}>
                  <Icons.Home />
                </span>
                Rooms
              </h2>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={addRoom}>
                <Icons.Plus /> Add Room
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <Icons.Home />
                </div>
                <h3 className={styles.emptyStateTitle}>No rooms yet</h3>
                <p className={styles.emptyStateText}>Add your first room to start calculating</p>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={addRoom}>
                  <Icons.Plus /> Add Room
                </button>
              </div>
            ) : (
              rooms.map(room => (
                <RoomForm
                  key={room.id}
                  room={room}
                  unitSystem={unitSystem}
                  onUpdate={updateRoom}
                  onDelete={deleteRoom}
                  onAddOpening={(roomId) => setOpeningModalState({ isOpen: true, roomId })}
                />
              ))
            )}
          </div>

          <SettingsPanel
            settings={settings}
            onUpdate={updateSettings}
            unitSystem={unitSystem}
          />

          <ExamplePanel onLoadExample={loadExample} />
        </main>

        <aside className={styles.sidebar}>
          <div className={styles.stickyWrapper}>
            <ResultsPanel results={results} />
          </div>
        </aside>
      </div>

      <AddOpeningModal
        isOpen={openingModalState.isOpen}
        onClose={() => setOpeningModalState({ isOpen: false, roomId: null })}
        onAdd={addOpening}
        unitSystem={unitSystem}
      />
    </div>
  );
}
