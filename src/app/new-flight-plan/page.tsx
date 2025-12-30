'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FlightPlanFormData, FlightPlanValidationResponse, FlightPlanTemplateListItem, FlightPlanTemplateData } from '@/lib/homebriefing/types';

// Map field codes to readable field names
const fieldCodeToName: Record<string, string> = {
  'F7': 'Aircraft ID (Field 7)',
  'F8a': 'Flight Rules (Field 8a)',
  'F8b': 'Flight Type (Field 8b)',
  'F9a': 'Number of Aircraft (Field 9a)',
  'F9b': 'Aircraft Type (Field 9b)',
  'F9c': 'Wake Turbulence (Field 9c)',
  'F10a': 'Equipment (Field 10a)',
  'F10b': 'Equipment (Field 10b)',
  'F13a': 'Departure Aerodrome (Field 13)',
  'F13b': 'EOBT (Field 13)',
  'F15a': 'Cruising Speed (Field 15)',
  'F15b': 'Cruising Level (Field 15)',
  'F15c': 'Route (Field 15)',
  'F16a': 'Destination (Field 16)',
  'F16b': 'Total EET (Field 16)',
  'F16c': '1st Alternate (Field 16)',
  'F16d': '2nd Alternate (Field 16)',
  'F18': 'Other Information (Field 18)',
  'F19': 'Supplementary (Field 19)',
  'F19a': 'Endurance (Field 19)',
  'F19b': 'Persons on Board (Field 19)',
  'F19c': 'Emergency Radio (Field 19)',
  'F19d': 'Survival Equipment (Field 19)',
  'F19e': 'Life Jackets (Field 19)',
  'F19f': 'Dinghies (Field 19)',
  'F19i': 'Aircraft Colour (Field 19)',
  'F19j': 'Remarks (Field 19)',
  'F19k': 'Pilot in Command (Field 19)',
  'FAddinfoPilottel': 'Pilot Telephone',
};

function getReadableFieldName(fieldCode: string): string {
  return fieldCodeToName[fieldCode] || fieldCode;
}

// Default form values for a typical VFR flight
const defaultFormData: FlightPlanFormData = {
  arcid: '',
  flRules: 'V',
  flType: 'G',
  arcNum: '',
  arcType: '',
  wakeTurbulenceCat: 'L',
  equipment: 'SGOVY/S',
  adep: '',
  eobdt: '',
  flSpeed: 'N0105',
  flLevel: 'VFR',
  flRoute: 'DCT',
  ades: '',
  totalEet: 30,
  adAltn1: '',
  adAltn2: '',
  flOther: '',
  flSuplementary: '',
  pilotTel: '',
};

// Flight rules options
const flightRulesOptions = [
  { value: 'V', label: 'VFR', description: 'Visual Flight Rules' },
  { value: 'I', label: 'IFR', description: 'Instrument Flight Rules' },
  { value: 'Y', label: 'Y', description: 'IFR first, then VFR' },
  { value: 'Z', label: 'Z', description: 'VFR first, then IFR' },
];

// Flight type options
const flightTypeOptions = [
  { value: 'G', label: 'General Aviation' },
  { value: 'S', label: 'Scheduled' },
  { value: 'N', label: 'Non-scheduled' },
  { value: 'M', label: 'Military' },
  { value: 'X', label: 'Other' },
];

// Wake turbulence categories
const wakeTurbulenceOptions = [
  { value: 'L', label: 'Light', description: '< 7000 kg' },
  { value: 'M', label: 'Medium', description: '7000 - 136000 kg' },
  { value: 'H', label: 'Heavy', description: '> 136000 kg' },
  { value: 'J', label: 'Super', description: 'A380' },
];

// Common equipment codes for GA
const equipmentPresets = [
  { value: 'SGOVY/S', label: 'Standard VFR (VOR, GPS)' },
  { value: 'SDGVORWY/S', label: 'Standard IFR' },
  { value: 'N/S', label: 'No equipment' },
];

// STS/ Special handling options with full descriptions
const stsOptions = [
  { code: 'ALTRV', desc: 'Altitude reservation', help: 'For a flight operated in accordance with an altitude reservation' },
  { code: 'ATFMX', desc: 'ATFM exemption', help: 'For a flight approved for exemption from ATFM measures by the appropriate ATS authority' },
  { code: 'FFR', desc: 'Fire-fighting', help: 'Fire-fighting mission' },
  { code: 'FLTCK', desc: 'Flight check', help: 'Flight check for calibration of NAVAIDs' },
  { code: 'HAZMAT', desc: 'Hazardous material', help: 'For a flight carrying hazardous material' },
  { code: 'HEAD', desc: 'Head of State', help: 'A flight with Head of State status' },
  { code: 'HOSP', desc: 'Medical flight', help: 'For a medical flight declared by medical authorities' },
  { code: 'HUM', desc: 'Humanitarian', help: 'For a flight operating on a humanitarian mission' },
  { code: 'MARSA', desc: 'Military separation', help: 'For a flight for which a military entity assumes responsibility for separation of military aircraft' },
  { code: 'MEDEVAC', desc: 'Medical evacuation', help: 'For a life critical medical emergency evacuation' },
  { code: 'NONRVSM', desc: 'Non-RVSM', help: 'For a non-RVSM capable flight intending to operate in RVSM airspace' },
  { code: 'SAR', desc: 'Search and rescue', help: 'For a flight engaged in a search and rescue mission' },
  { code: 'STATE', desc: 'State flight', help: 'For a flight engaged in military, customs or police services' },
];

// PBN/ Performance Based Navigation with required Field 10a descriptors
const pbnRnavOptions = [
  { code: 'A1', desc: 'RNAV 10 (RNP 10)', req: '' },
  { code: 'B1', desc: 'RNAV 5 all sensors', req: 'O or S, D, G, I' },
  { code: 'B2', desc: 'RNAV 5 GNSS', req: 'G' },
  { code: 'B3', desc: 'RNAV 5 DME/DME', req: 'D' },
  { code: 'B4', desc: 'RNAV 5 VOR/DME', req: 'O or S, D' },
  { code: 'B5', desc: 'RNAV 5 INS/IRS', req: 'I' },
  { code: 'B6', desc: 'RNAV 5 LORANC', req: '' },
  { code: 'C1', desc: 'RNAV 2 all sensors', req: 'D, G, I' },
  { code: 'C2', desc: 'RNAV 2 GNSS', req: 'G' },
  { code: 'C3', desc: 'RNAV 2 DME/DME', req: 'D' },
  { code: 'C4', desc: 'RNAV 2 DME/DME/IRU', req: 'D, I' },
  { code: 'D1', desc: 'RNAV 1 all sensors', req: 'D, G, I' },
  { code: 'D2', desc: 'RNAV 1 GNSS', req: 'G' },
  { code: 'D3', desc: 'RNAV 1 DME/DME', req: 'D' },
  { code: 'D4', desc: 'RNAV 1 DME/DME/IRU', req: 'D, I' },
];

const pbnRnpOptions = [
  { code: 'L1', desc: 'RNP 4', req: '' },
  { code: 'O1', desc: 'Basic RNP 1 all sensors', req: 'D, G, I' },
  { code: 'O2', desc: 'Basic RNP 1 GNSS', req: 'G' },
  { code: 'O3', desc: 'Basic RNP 1 DME/DME', req: 'D' },
  { code: 'O4', desc: 'Basic RNP 1 DME/DME/IRU', req: 'D, I' },
  { code: 'S1', desc: 'RNP APCH', req: '' },
  { code: 'S2', desc: 'RNP APCH BARO-VNAV', req: '' },
  { code: 'T1', desc: 'RNP AR APCH with RF', req: '(special auth)' },
  { code: 'T2', desc: 'RNP AR APCH w/o RF', req: '(special auth)' },
];

// Field 18 text indicators with full help descriptions
const field18TextIndicators = [
  { code: 'NAV', desc: 'Navigation equipment', placeholder: 'GBAS SBAS', help: 'Significant data related to navigation equipment, other than specified in PBN/. Indicate GNSS augmentation with a space between methods, e.g. NAV/GBAS SBAS. Required if Z in Field 10a.' },
  { code: 'COM', desc: 'Communication', placeholder: '', help: 'Indicate communications applications or capabilities not specified in Field 10a. Required if Z in Field 10a.' },
  { code: 'DAT', desc: 'Data applications', placeholder: '', help: 'Indicate data applications or capabilities not specified in Field 10a. Required if Z in Field 10a.' },
  { code: 'SUR', desc: 'Surveillance', placeholder: '', help: 'Indicate surveillance applications or capabilities not specified in Field 10b.' },
  { code: 'DEP', desc: 'Departure aerodrome', placeholder: 'GRASSTRIP 52N00530E', help: 'Name and location of departure aerodrome if ZZZZ in Field 13, or ICAO indicator of ATS unit for AFIL.' },
  { code: 'DEST', desc: 'Destination aerodrome', placeholder: '', help: 'Name and location of destination aerodrome if ZZZZ in Field 16.' },
  { code: 'REG', desc: 'Registration', placeholder: '', help: 'Nationality or common mark and registration mark if different from aircraft identification in Item 7.' },
  { code: 'EET', desc: 'FIR boundary times', placeholder: 'EHAA0010', help: 'Significant points or FIR boundary designators and accumulated estimated elapsed times from take-off.' },
  { code: 'SEL', desc: 'SELCAL code', placeholder: 'ABCD', help: 'SELCAL Code for aircraft so equipped.' },
  { code: 'TYP', desc: 'Aircraft type', placeholder: '', help: 'Type(s) of aircraft if ZZZZ in Field 9, preceded by number(s) if needed.' },
  { code: 'CODE', desc: 'Mode S hex code', placeholder: '48417F', help: 'Aircraft address in alphanumerical code of six hexadecimal characters (e.g. F00001).' },
  { code: 'DLE', desc: 'Enroute delay', placeholder: 'MDG0030', help: 'Enroute delay or holding: significant point followed by delay in hhmm. Example: DLE/MDG0030.' },
  { code: 'OPR', desc: 'Operator', placeholder: '', help: 'ICAO designator or name of aircraft operating agency if different from identification in Field 7.' },
  { code: 'ORGN', desc: 'AFTN address', placeholder: '', help: "Originator's 8 letter AFTN address or contact details if originator not readily identified." },
  { code: 'ALTN', desc: 'Alternate aerodrome', placeholder: '', help: 'Name of destination alternate aerodrome(s) if ZZZZ in Field 16.' },
  { code: 'RALT', desc: 'En-route alternate', placeholder: '', help: 'ICAO four letter indicator(s) for en-route alternate(s) or name(s) if no indicator allocated.' },
  { code: 'TALT', desc: 'Take-off alternate', placeholder: '', help: 'ICAO four letter indicator(s) for take-off alternate or name if no indicator allocated.' },
  { code: 'RIF', desc: 'Revised destination', placeholder: 'DTA HEC KLAX', help: 'Route details to revised destination aerodrome followed by ICAO indicator. Subject to reclearance in flight.' },
  { code: 'RMK', desc: 'Remarks', placeholder: '', help: 'Any other plain language remarks when required by ATS authority or deemed necessary.' },
  { code: 'RVR', desc: 'Minimum RVR', placeholder: '200', help: 'Runway Visual Range - indicates minimal RVR in meters.' },
];

// PER/ options
const perOptions = ['', 'A', 'B', 'C', 'D', 'E', 'H'];

// RFP/ Replacement Flight Plan options
const rfpOptions = ['', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9'];

// Help tooltip component
function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block ml-1">
      <svg className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="invisible group-hover:visible absolute z-50 w-64 p-2 text-xs text-white bg-slate-800 rounded-lg shadow-lg -left-28 bottom-6 leading-relaxed">
        {text}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></span>
      </span>
    </span>
  );
}

// Field 18 Settings Modal Component
interface Field18Data {
  sts: string[];
  pbn: string[];
  per: string;
  eurProtected: boolean;
  rfp: string;
  stayInfo: string[];  // STAYINFO1-9
  textFields: Record<string, string>;
}

function Field18SettingsModal({
  isOpen,
  onClose,
  onApply,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: Field18Data) => void;
  initialData: Field18Data;
}) {
  const [sts, setSts] = useState<string[]>(initialData.sts);
  const [pbn, setPbn] = useState<string[]>(initialData.pbn);
  const [per, setPer] = useState(initialData.per);
  const [eurProtected, setEurProtected] = useState(initialData.eurProtected);
  const [rfp, setRfp] = useState(initialData.rfp);
  const [stayInfo, setStayInfo] = useState<string[]>(initialData.stayInfo);
  const [textFields, setTextFields] = useState<Record<string, string>>(initialData.textFields);

  if (!isOpen) return null;

  const toggleSts = (code: string) => {
    setSts(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const togglePbn = (code: string) => {
    setPbn(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const updateStayInfo = (index: number, value: string) => {
    setStayInfo(prev => {
      const newArr = [...prev];
      newArr[index] = value;
      return newArr;
    });
  };

  const handleApply = () => {
    onApply({ sts, pbn, per, eurProtected, rfp, stayInfo, textFields });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">Field 18 Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* STS/ Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-700">STS/ Special Handling</h3>
              <HelpTooltip text="Reason for special handling by ATS, e.g. a search and rescue mission. EXM833 write as COM/EXM833." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {stsOptions.map(opt => (
                <label key={opt.code} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={sts.includes(opt.code)}
                    onChange={() => toggleSts(opt.code)}
                    className="rounded border-slate-300"
                  />
                  <span className="font-mono font-medium w-20">{opt.code}</span>
                  <span className="text-slate-600 text-xs flex-1">{opt.desc}</span>
                  <HelpTooltip text={opt.help} />
                </label>
              ))}
            </div>
          </div>

          {/* PBN/ Section */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-700">PBN/ Performance Based Navigation</h3>
              <HelpTooltip text="Indication of RNAV and/or RNP capabilities. Up to a maximum of 8 entries are allowed. If R in Field 10a is present, PBN/ indicator must be defined." />
            </div>
            <p className="text-xs text-slate-500 mb-3">Max 8 entries ({pbn.length}/8 selected). Required if R in Field 10a.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">RNAV Specifications</p>
                <div className="space-y-1">
                  {pbnRnavOptions.map(opt => (
                    <label key={opt.code} className={`flex items-center gap-2 text-sm cursor-pointer p-1 rounded ${pbn.includes(opt.code) ? 'bg-purple-50' : 'hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={pbn.includes(opt.code)}
                        onChange={() => togglePbn(opt.code)}
                        className="rounded border-slate-300"
                        disabled={pbn.length >= 8 && !pbn.includes(opt.code)}
                      />
                      <span className="font-mono font-medium w-6">{opt.code}</span>
                      <span className="text-slate-600 text-xs flex-1">{opt.desc}</span>
                      {opt.req && <span className="text-xs text-purple-600 font-mono">{opt.req}</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">RNP Specifications</p>
                <div className="space-y-1">
                  {pbnRnpOptions.map(opt => (
                    <label key={opt.code} className={`flex items-center gap-2 text-sm cursor-pointer p-1 rounded ${pbn.includes(opt.code) ? 'bg-purple-50' : 'hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={pbn.includes(opt.code)}
                        onChange={() => togglePbn(opt.code)}
                        className="rounded border-slate-300"
                        disabled={pbn.length >= 8 && !pbn.includes(opt.code)}
                      />
                      <span className="font-mono font-medium w-6">{opt.code}</span>
                      <span className="text-slate-600 text-xs flex-1">{opt.desc}</span>
                      {opt.req && <span className="text-xs text-purple-600 font-mono">{opt.req}</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* EUR/ Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-700">EUR/</h3>
              <HelpTooltip text="Specific to EUR region" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
              <input
                type="checkbox"
                checked={eurProtected}
                onChange={(e) => setEurProtected(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="font-mono font-medium">PROTECTED</span>
              <span className="text-slate-600 text-xs">(Specific to EUR region)</span>
            </label>
          </div>

          {/* PER/ Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-700">PER/ Aircraft Performance</h3>
              <HelpTooltip text="Aircraft performance data, indicated by a single letter as specified in PANS-OPS Doc 8168, Volume I - Flight Procedures, if so prescribed by the appropriate ATS authority." />
            </div>
            <select
              value={per}
              onChange={(e) => setPer(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            >
              {perOptions.map(opt => (
                <option key={opt || 'empty'} value={opt}>{opt || '(none)'}</option>
              ))}
            </select>
          </div>

          {/* RFP/ Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-700">RFP/ Replacement Flight Plan</h3>
              <HelpTooltip text="Replacement Flight Plan. Q1 indicates the first replacement, Q2 second replacement, and so on. Example: RFP/Q1" />
            </div>
            <select
              value={rfp}
              onChange={(e) => setRfp(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            >
              {rfpOptions.map(opt => (
                <option key={opt || 'empty'} value={opt}>{opt || '(none)'}</option>
              ))}
            </select>
          </div>

          {/* Text Indicators */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-3">Other Indicators</h3>
            <div className="grid grid-cols-1 gap-3">
              {field18TextIndicators.map(ind => (
                <div key={ind.code} className="flex items-start gap-2">
                  <div className="flex items-center gap-1 w-20 pt-2">
                    <label className="font-mono text-sm font-medium text-slate-700">{ind.code}/</label>
                    <HelpTooltip text={ind.help} />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={textFields[ind.code] || ''}
                      onChange={(e) => setTextFields(prev => ({ ...prev, [ind.code]: e.target.value.toUpperCase() }))}
                      placeholder={ind.placeholder || ind.desc}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono uppercase"
                    />
                    <p className="text-xs text-slate-500 mt-0.5">{ind.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STAYINFO Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-700">STAYINFO/ Stay Information</h3>
              <HelpTooltip text="To indicate the reason for STAY in Field 15, a free text STAYINFO indicator shall be inserted in Field 18. Example: STAYINFO1/CALIBRATION OF SHA VOR" />
            </div>
            <p className="text-xs text-slate-500 mb-3">Used when STAY is present in Field 15 route.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <div key={num} className="flex items-center gap-2">
                  <label className="font-mono text-sm w-24 text-slate-600">STAYINFO{num}/</label>
                  <input
                    type="text"
                    value={stayInfo[num - 1] || ''}
                    onChange={(e) => updateStayInfo(num - 1, e.target.value.toUpperCase())}
                    placeholder="Reason for stay"
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm font-mono uppercase"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleApply} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to build Field 18 string from structured data
function buildField18String(data: Field18Data): string {
  const parts: string[] = [];

  if (data.sts.length > 0) {
    parts.push(`STS/${data.sts.join(' ')}`);
  }
  if (data.pbn.length > 0) {
    parts.push(`PBN/${data.pbn.join('')}`);
  }
  if (data.eurProtected) {
    parts.push('EUR/PROTECTED');
  }
  if (data.per) {
    parts.push(`PER/${data.per}`);
  }
  if (data.rfp) {
    parts.push(`RFP/${data.rfp}`);
  }
  for (const [code, value] of Object.entries(data.textFields)) {
    if (value) {
      parts.push(`${code}/${value}`);
    }
  }
  // STAYINFO1-9
  data.stayInfo.forEach((info, index) => {
    if (info) {
      parts.push(`STAYINFO${index + 1}/${info}`);
    }
  });

  return parts.join(' ');
}

// Helper to parse Field 18 string to structured data
function parseField18String(str: string): Field18Data {
  const data: Field18Data = { sts: [], pbn: [], per: '', eurProtected: false, rfp: '', stayInfo: Array(9).fill(''), textFields: {} };
  if (!str) return data;

  // Match patterns like CODE/VALUE (including multi-word values)
  const matches = str.match(/([A-Z0-9]+)\/([^ ]+(?:\s+[^ /]+)*?)(?=\s+[A-Z0-9]+\/|$)/g);
  if (!matches) return data;

  for (const match of matches) {
    const slashIndex = match.indexOf('/');
    const code = match.substring(0, slashIndex);
    const value = match.substring(slashIndex + 1);

    if (code === 'STS') {
      data.sts = value.split(' ').filter(Boolean);
    } else if (code === 'PBN') {
      // PBN codes are concatenated like "B2D2S1"
      data.pbn = value.match(/[A-Z]\d/g) || [];
    } else if (code === 'PER') {
      data.per = value;
    } else if (code === 'EUR' && value === 'PROTECTED') {
      data.eurProtected = true;
    } else if (code === 'RFP') {
      data.rfp = value;
    } else if (code.startsWith('STAYINFO')) {
      const num = parseInt(code.replace('STAYINFO', ''));
      if (num >= 1 && num <= 9) {
        data.stayInfo[num - 1] = value;
      }
    } else {
      data.textFields[code] = value;
    }
  }

  return data;
}

// Field 19 Supplementary Information data structure
interface Field19Data {
  endurance: string;      // E/ HHMM
  persons: string;        // P/ 3 digits or TBN
  radioUhf: boolean;      // R/ U
  radioVhf: boolean;      // R/ V
  radioElba: boolean;     // R/ E
  survivalPolar: boolean; // S/ P
  survivalDesert: boolean;// S/ D
  survivalMaritime: boolean; // S/ M
  survivalJungle: boolean;// S/ J
  jacketsLight: boolean;  // J/ L
  jacketsFluores: boolean;// J/ F
  jacketsUhf: boolean;    // J/ U
  jacketsVhf: boolean;    // J/ V
  dinghiesEnabled: boolean;
  dinghiesNumber: string; // D/ number
  dinghiesCapacity: string; // capacity
  dinghiesCover: boolean; // C
  dinghiesColour: string; // colour
  aircraftColour: string; // A/
  remarks: string;        // N/ remarks
  pilotInCommand: string; // C/
}

const defaultField19Data: Field19Data = {
  endurance: '',
  persons: '',
  radioUhf: false,
  radioVhf: true,
  radioElba: true,
  survivalPolar: false,
  survivalDesert: false,
  survivalMaritime: false,
  survivalJungle: false,
  jacketsLight: false,
  jacketsFluores: false,
  jacketsUhf: false,
  jacketsVhf: false,
  dinghiesEnabled: false,
  dinghiesNumber: '',
  dinghiesCapacity: '',
  dinghiesCover: false,
  dinghiesColour: '',
  aircraftColour: '',
  remarks: '',
  pilotInCommand: '',
};

// Build Field 19 string from structured data
function buildField19String(data: Field19Data): string {
  const parts: string[] = [];

  // E/ Endurance
  if (data.endurance) {
    parts.push(`E\\${data.endurance}`);
  }

  // P/ Persons
  if (data.persons) {
    parts.push(`P\\${data.persons}`);
  }

  // R/ Radio
  const radio: string[] = [];
  if (data.radioUhf) radio.push('U');
  if (data.radioVhf) radio.push('V');
  if (data.radioElba) radio.push('E');
  if (radio.length > 0) {
    parts.push(`R\\${radio.join('')}`);
  }

  // S/ Survival
  const survival: string[] = [];
  if (data.survivalPolar) survival.push('P');
  if (data.survivalDesert) survival.push('D');
  if (data.survivalMaritime) survival.push('M');
  if (data.survivalJungle) survival.push('J');
  if (survival.length > 0) {
    parts.push(`S\\${survival.join('')}`);
  }

  // J/ Jackets
  const jackets: string[] = [];
  if (data.jacketsLight) jackets.push('L');
  if (data.jacketsFluores) jackets.push('F');
  if (data.jacketsUhf) jackets.push('U');
  if (data.jacketsVhf) jackets.push('V');
  if (jackets.length > 0) {
    parts.push(`J\\${jackets.join('')}`);
  }

  // D/ Dinghies
  if (data.dinghiesEnabled && data.dinghiesNumber) {
    let dPart = `D\\${data.dinghiesNumber}`;
    if (data.dinghiesCapacity) dPart += ` ${data.dinghiesCapacity}`;
    if (data.dinghiesCover) dPart += ' C';
    if (data.dinghiesColour) dPart += ` ${data.dinghiesColour}`;
    parts.push(dPart);
  }

  // A/ Aircraft colour
  if (data.aircraftColour) {
    parts.push(`A\\${data.aircraftColour}`);
  }

  // N/ Remarks
  if (data.remarks) {
    parts.push(`N\\${data.remarks}`);
  }

  // C/ Pilot in command
  if (data.pilotInCommand) {
    parts.push(`C\\${data.pilotInCommand}`);
  }

  return parts.join(' ');
}

// Parse Field 19 string to structured data
function parseField19String(str: string): Field19Data {
  const data = { ...defaultField19Data };
  if (!str) return data;

  // Match patterns like X\VALUE
  const regex = /([A-Z])\\([^ ]*)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const [, code, value] = match;
    switch (code) {
      case 'E':
        data.endurance = value;
        break;
      case 'P':
        data.persons = value;
        break;
      case 'R':
        data.radioUhf = value.includes('U');
        data.radioVhf = value.includes('V');
        data.radioElba = value.includes('E');
        break;
      case 'S':
        data.survivalPolar = value.includes('P');
        data.survivalDesert = value.includes('D');
        data.survivalMaritime = value.includes('M');
        data.survivalJungle = value.includes('J');
        break;
      case 'J':
        data.jacketsLight = value.includes('L');
        data.jacketsFluores = value.includes('F');
        data.jacketsUhf = value.includes('U');
        data.jacketsVhf = value.includes('V');
        break;
      case 'D':
        data.dinghiesEnabled = true;
        data.dinghiesNumber = value;
        break;
      case 'A':
        data.aircraftColour = value;
        break;
      case 'N':
        data.remarks = value;
        break;
      case 'C':
        // Could be Cover or Pilot in Command - check context
        if (str.indexOf(`C\\${value}`) > str.indexOf('D\\')) {
          data.pilotInCommand = value;
        } else {
          data.dinghiesCover = true;
        }
        break;
    }
  }

  return data;
}

function formatDateTimeLocal(): string {
  const now = new Date();
  // Round up to next 15 minutes
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes);
  now.setSeconds(0);
  now.setMilliseconds(0);
  // Add 1 hour buffer
  now.setHours(now.getHours() + 1);
  return now.toISOString().slice(0, 16);
}

function formatEobdt(dateTimeLocal: string): string {
  // Convert from datetime-local format to HB format "YYYY-MM-DD HH:mm"
  const date = new Date(dateTimeLocal);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

export default function NewFlightPlanPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FlightPlanFormData>({
    ...defaultFormData,
    eobdt: formatDateTimeLocal(),
  });
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<FlightPlanValidationResponse | null>(null);
  const [utcTime, setUtcTime] = useState<string>('');
  const [showField18Modal, setShowField18Modal] = useState(false);
  const [field18Data, setField18Data] = useState<Field18Data>({ sts: [], pbn: [], per: '', eurProtected: false, rfp: '', stayInfo: Array(9).fill(''), textFields: {} });
  const [field19Data, setField19Data] = useState<Field19Data>(defaultField19Data);

  // Template state
  const [templates, setTemplates] = useState<FlightPlanTemplateListItem[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState<number | null>(null);

  // Save template state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [saveTemplateRawResponse, setSaveTemplateRawResponse] = useState<string | null>(null);

  // Delete template state
  const [deletingTemplate, setDeletingTemplate] = useState<number | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/flight-plans/templates');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      }
    }
    fetchTemplates();
  }, [router]);

  // Load template data
  const loadTemplate = async (tplId: number) => {
    setLoadingTemplate(tplId);
    setShowTemplateDropdown(false);

    try {
      const res = await fetch(`/api/flight-plans/templates/${tplId}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        console.error('Failed to load template');
        return;
      }

      const data = await res.json();
      const tpl: FlightPlanTemplateData = data.template;

      if (!tpl) return;

      // Build equipment string from 10a/10b/10c
      let equipment = tpl.equipment10a || '';
      if (tpl.equipment10b) {
        equipment += '/' + tpl.equipment10b;
      }

      // Build speed string
      let flSpeed = '';
      if (tpl.flSpeedMeasure && tpl.flSpeedValue) {
        flSpeed = tpl.flSpeedMeasure + tpl.flSpeedValue.padStart(4, '0');
      }

      // Build level string
      let flLevel = tpl.flLevelMeasure || 'VFR';
      if (tpl.flLevelValue && tpl.flLevelMeasure !== 'VFR') {
        flLevel = tpl.flLevelMeasure + tpl.flLevelValue;
      }

      // Update form data with template values
      setFormData(prev => ({
        ...prev,
        arcid: tpl.arcid || prev.arcid,
        flRules: (tpl.flRules as FlightPlanFormData['flRules']) || prev.flRules,
        flType: (tpl.flType as FlightPlanFormData['flType']) || prev.flType,
        arcType: tpl.arcType || prev.arcType,
        wakeTurbulenceCat: (tpl.wakeTurbulenceCat as FlightPlanFormData['wakeTurbulenceCat']) || prev.wakeTurbulenceCat,
        equipment: equipment || prev.equipment,
        adep: tpl.adep || prev.adep,
        flSpeed: flSpeed || prev.flSpeed,
        flLevel: flLevel,
        ades: tpl.ades || prev.ades,
        flRoute: tpl.flRoute || prev.flRoute,
        totalEet: tpl.totalEet || prev.totalEet,
        adAltn1: tpl.adAltn1 || prev.adAltn1,
        adAltn2: tpl.adAltn2 || prev.adAltn2,
        flOther: tpl.flOther || prev.flOther,
        pilotTel: tpl.pilotTel || prev.pilotTel,
      }));

      // Update Field 19 data from template
      if (tpl.aircraftColour || tpl.pilotInCommand || tpl.radio) {
        const newField19: Field19Data = {
          ...defaultField19Data,
          radioUhf: tpl.radio?.includes('U') || false,
          radioVhf: tpl.radio?.includes('V') || false,
          radioElba: tpl.radio?.includes('E') || false,
          aircraftColour: tpl.aircraftColour || '',
          pilotInCommand: tpl.pilotInCommand || '',
          dinghiesEnabled: !!tpl.dinghiesNumber,
          dinghiesNumber: tpl.dinghiesNumber || '',
          dinghiesCapacity: tpl.dinghiesCapacity || '',
          dinghiesCover: tpl.dinghiesCover || false,
          dinghiesColour: tpl.dinghiesColour || '',
        };
        setField19Data(newField19);
        const field19String = buildField19String(newField19);
        setFormData(prev => ({ ...prev, flSuplementary: field19String }));
      }

      // Parse Field 18 if present
      if (tpl.flOther) {
        const parsed = parseField18String(tpl.flOther);
        setField18Data(parsed);
      }

      // Clear validation result when loading template
      setValidationResult(null);

    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoadingTemplate(null);
    }
  };

  // Save current form as template
  const saveTemplate = async () => {
    if (!saveTemplateName.trim()) {
      setSaveTemplateError('Template name is required');
      return;
    }

    setSavingTemplate(true);
    setSaveTemplateError(null);
    setSaveTemplateRawResponse(null);

    try {
      // Build radio string from field19Data
      let radio = '';
      if (field19Data.radioUhf) radio += 'U';
      if (field19Data.radioVhf) radio += 'V';
      if (field19Data.radioElba) radio += 'E';

      // Build survival string
      let survival = '';
      if (field19Data.survivalPolar) survival += 'P';
      if (field19Data.survivalDesert) survival += 'D';
      if (field19Data.survivalMaritime) survival += 'M';
      if (field19Data.survivalJungle) survival += 'J';

      // Build jackets string
      let jackets = '';
      if (field19Data.jacketsLight) jackets += 'L';
      if (field19Data.jacketsFluores) jackets += 'F';
      if (field19Data.jacketsUhf) jackets += 'U';
      if (field19Data.jacketsVhf) jackets += 'V';

      const res = await fetch('/api/flight-plans/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tplName: saveTemplateName.trim().toUpperCase(),
          formData,
          field19: {
            radio,
            survival,
            jackets,
            endurance: field19Data.endurance,
            persons: field19Data.persons,
            dinghiesNumber: field19Data.dinghiesNumber,
            dinghiesCapacity: field19Data.dinghiesCapacity,
            dinghiesCover: field19Data.dinghiesCover,
            dinghiesColour: field19Data.dinghiesColour,
            aircraftColour: field19Data.aircraftColour,
            remarks: field19Data.remarks,
            pilotInCommand: field19Data.pilotInCommand,
          },
        }),
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setSaveTemplateError(data.error || 'Failed to save template');
        if (data.rawResponse) {
          setSaveTemplateRawResponse(data.rawResponse);
        }
        return;
      }

      // Success - close modal and refresh templates list
      setShowSaveTemplateModal(false);
      setSaveTemplateName('');

      // Refresh templates list
      const templatesRes = await fetch('/api/flight-plans/templates');
      if (templatesRes.status === 401) {
        router.push('/login');
        return;
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      setSaveTemplateError('Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Delete template
  const deleteTemplate = async (tplId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading the template

    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    setDeletingTemplate(tplId);

    try {
      const res = await fetch(`/api/flight-plans/templates/${tplId}`, {
        method: 'DELETE',
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        console.error('Failed to delete template:', data.error);
        return;
      }

      // Remove from local state
      setTemplates(prev => prev.filter(t => t.tplId !== tplId));
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setDeletingTemplate(null);
    }
  };

  // Update UTC time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().slice(11, 19));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (field: keyof FlightPlanFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation when form changes
    setValidationResult(null);
  };

  const handleField18Apply = (data: Field18Data) => {
    setField18Data(data);
    const field18String = buildField18String(data);
    handleInputChange('flOther', field18String);
  };

  const openField18Modal = () => {
    // Parse current field 18 string to populate modal
    const parsed = parseField18String(formData.flOther || '');
    setField18Data(parsed);
    setShowField18Modal(true);
  };

  const updateField19 = (updates: Partial<Field19Data>) => {
    const newData = { ...field19Data, ...updates };
    setField19Data(newData);
    const field19String = buildField19String(newData);
    handleInputChange('flSuplementary', field19String);
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);

    try {
      // Convert datetime-local to HB format
      const submitData = {
        ...formData,
        eobdt: formatEobdt(formData.eobdt),
      };

      const res = await fetch('/api/flight-plans/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      const result: FlightPlanValidationResponse = await res.json();
      setValidationResult(result);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        isError: true,
        fplIsOk: false,
        errorMessages: ['Failed to validate flight plan'],
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-slate-500 hover:text-slate-700 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-slate-800">New Flight Plan</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Template dropdown */}
              {templates.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                    disabled={loadingTemplate !== null}
                  >
                    {loadingTemplate !== null ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Load Template
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {showTemplateDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowTemplateDropdown(false)}
                      />
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                        {templates.map((tpl) => (
                          <div
                            key={tpl.tplId}
                            className="flex items-center justify-between px-2 py-1 hover:bg-slate-50 transition"
                          >
                            <button
                              onClick={() => loadTemplate(tpl.tplId)}
                              disabled={loadingTemplate === tpl.tplId || deletingTemplate === tpl.tplId}
                              className="flex-1 text-left px-2 py-1 text-sm flex items-center justify-between disabled:opacity-50"
                            >
                              <span className="font-mono font-medium text-blue-600">{tpl.tplName}</span>
                              <span className="text-xs text-slate-400">#{tpl.tplId}</span>
                            </button>
                            <button
                              onClick={(e) => deleteTemplate(tpl.tplId, e)}
                              disabled={deletingTemplate === tpl.tplId}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50"
                              title="Delete template"
                            >
                              {deletingTemplate === tpl.tplId ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Save Template button */}
              <button
                type="button"
                onClick={() => {
                  setSaveTemplateName(formData.arcid || '');
                  setSaveTemplateError(null);
                  setShowSaveTemplateModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Save Template
              </button>
              <div className="text-sm font-mono text-slate-600">
                <span className="text-slate-400">UTC</span> {utcTime}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
          {/* Field 7 - Aircraft Identification */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">7</span>
              Aircraft Identification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Registration (ARCID)
                </label>
                <input
                  type="text"
                  value={formData.arcid}
                  onChange={(e) => handleInputChange('arcid', e.target.value.toUpperCase())}
                  placeholder="e.g. PHHLR"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  maxLength={7}
                />
              </div>
            </div>
          </section>

          {/* Field 8 - Flight Rules and Type */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">8</span>
              Flight Rules and Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Flight Rules
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {flightRulesOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleInputChange('flRules', opt.value as FlightPlanFormData['flRules'])}
                      className={`p-3 rounded-lg border text-left transition ${
                        formData.flRules === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type of Flight
                </label>
                <select
                  value={formData.flType}
                  onChange={(e) => handleInputChange('flType', e.target.value as FlightPlanFormData['flType'])}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {flightTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Field 9 - Aircraft Type and Wake Turbulence */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">9</span>
              Aircraft Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ICAO Type Designator
                </label>
                <input
                  type="text"
                  value={formData.arcType}
                  onChange={(e) => handleInputChange('arcType', e.target.value.toUpperCase())}
                  placeholder="e.g. DR40, C172, PA28"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  maxLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Wake Turbulence Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {wakeTurbulenceOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleInputChange('wakeTurbulenceCat', opt.value as FlightPlanFormData['wakeTurbulenceCat'])}
                      className={`p-2 rounded-lg border text-center transition ${
                        formData.wakeTurbulenceCat === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold">{opt.value}</div>
                      <div className="text-xs text-slate-500">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Field 10 - Equipment */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">10</span>
              Equipment
            </h2>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {equipmentPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleInputChange('equipment', preset.value)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                      formData.equipment === preset.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.equipment}
                onChange={(e) => handleInputChange('equipment', e.target.value.toUpperCase())}
                placeholder="NAV/COM equipment code"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
              />
            </div>
          </section>

          {/* Field 13 - Departure */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">13</span>
              Departure
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Departure Aerodrome (ADEP)
                </label>
                <input
                  type="text"
                  value={formData.adep}
                  onChange={(e) => handleInputChange('adep', e.target.value.toUpperCase())}
                  placeholder="e.g. EHRD"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  maxLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estimated Off-Block Time (UTC)
                </label>
                <input
                  type="datetime-local"
                  value={formData.eobdt}
                  onChange={(e) => handleInputChange('eobdt', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Field 15 - Route */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">15</span>
              Cruising Speed, Level and Route
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cruising Speed
                </label>
                <input
                  type="text"
                  value={formData.flSpeed}
                  onChange={(e) => handleInputChange('flSpeed', e.target.value.toUpperCase())}
                  placeholder="e.g. N0105"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                  maxLength={5}
                />
                <p className="text-xs text-slate-500 mt-1">N = knots (N0105 = 105 kt)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cruising Level
                </label>
                <input
                  type="text"
                  value={formData.flLevel}
                  onChange={(e) => handleInputChange('flLevel', e.target.value.toUpperCase())}
                  placeholder="e.g. VFR, F065, A025"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                  maxLength={5}
                />
                <p className="text-xs text-slate-500 mt-1">VFR, F = FL, A = altitude</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Route
              </label>
              <textarea
                value={formData.flRoute}
                onChange={(e) => handleInputChange('flRoute', e.target.value.toUpperCase())}
                placeholder="e.g. DCT SPY DCT"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                rows={2}
              />
            </div>
          </section>

          {/* Field 16 - Destination and Alternates */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">16</span>
              Destination
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Destination (ADES)
                </label>
                <input
                  type="text"
                  value={formData.ades}
                  onChange={(e) => handleInputChange('ades', e.target.value.toUpperCase())}
                  placeholder="e.g. EHMZ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  maxLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total EET (minutes)
                </label>
                <input
                  type="number"
                  value={formData.totalEet}
                  onChange={(e) => handleInputChange('totalEet', parseInt(e.target.value) || 0)}
                  min={1}
                  max={9999}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  1st Alternate
                </label>
                <input
                  type="text"
                  value={formData.adAltn1 || ''}
                  onChange={(e) => handleInputChange('adAltn1', e.target.value.toUpperCase())}
                  placeholder="e.g. EHSE"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  maxLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  2nd Alternate
                </label>
                <input
                  type="text"
                  value={formData.adAltn2 || ''}
                  onChange={(e) => handleInputChange('adAltn2', e.target.value.toUpperCase())}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  maxLength={4}
                />
              </div>
            </div>
          </section>

          {/* Field 18 - Other Information */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">18</span>
                Other Information
              </h2>
              <button
                type="button"
                onClick={openField18Modal}
                className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Sub-field selector
              </button>
            </div>

            {/* Active indicators preview */}
            {(field18Data.sts.length > 0 || field18Data.pbn.length > 0 || field18Data.per || field18Data.eurProtected || field18Data.rfp) && (
              <div className="mb-3 flex flex-wrap gap-2">
                {field18Data.sts.length > 0 && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-mono">
                    STS/{field18Data.sts.join(' ')}
                  </span>
                )}
                {field18Data.pbn.length > 0 && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-mono">
                    PBN/{field18Data.pbn.join('')}
                  </span>
                )}
                {field18Data.eurProtected && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                    EUR/PROTECTED
                  </span>
                )}
                {field18Data.per && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-mono">
                    PER/{field18Data.per}
                  </span>
                )}
                {field18Data.rfp && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-mono">
                    RFP/{field18Data.rfp}
                  </span>
                )}
              </div>
            )}

            <textarea
              value={formData.flOther || ''}
              onChange={(e) => handleInputChange('flOther', e.target.value.toUpperCase())}
              placeholder="Use sub-field selector or type directly (e.g. PBN/B2D2 DOF/250115)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
              rows={3}
            />
            <p className="text-xs text-slate-500 mt-1">
              Common: STS/, PBN/, NAV/, DEP/, DEST/, REG/, EET/, CODE/, RMK/
            </p>
          </section>

          {/* Field 19 - Supplementary Information */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">19</span>
              Supplementary Information
            </h2>

            <div className="space-y-6">
              {/* E/ and P/ - Endurance and Persons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    E/ Endurance (HHMM)
                  </label>
                  <input
                    type="text"
                    value={field19Data.endurance}
                    onChange={(e) => updateField19({ endurance: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="0500"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Fuel endurance in hours and minutes</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    P/ Persons on Board
                  </label>
                  <input
                    type="text"
                    value={field19Data.persons}
                    onChange={(e) => updateField19({ persons: e.target.value.toUpperCase().slice(0, 3) })}
                    placeholder="002"
                    maxLength={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                  />
                  <p className="text-xs text-slate-500 mt-1">Number or TBN</p>
                </div>
              </div>

              {/* R/ Emergency Radio */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  R/ Emergency Radio
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.radioUhf}
                      onChange={(e) => updateField19({ radioUhf: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">U (UHF 243.0 MHz)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.radioVhf}
                      onChange={(e) => updateField19({ radioVhf: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">V (VHF 121.5 MHz)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.radioElba}
                      onChange={(e) => updateField19({ radioElba: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">E (ELT/ELBA)</span>
                  </label>
                </div>
              </div>

              {/* S/ Survival Equipment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  S/ Survival Equipment
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.survivalPolar}
                      onChange={(e) => updateField19({ survivalPolar: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">P (Polar)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.survivalDesert}
                      onChange={(e) => updateField19({ survivalDesert: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">D (Desert)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.survivalMaritime}
                      onChange={(e) => updateField19({ survivalMaritime: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">M (Maritime)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.survivalJungle}
                      onChange={(e) => updateField19({ survivalJungle: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">J (Jungle)</span>
                  </label>
                </div>
              </div>

              {/* J/ Jackets */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  J/ Life Jackets
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.jacketsLight}
                      onChange={(e) => updateField19({ jacketsLight: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">L (Lights)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.jacketsFluores}
                      onChange={(e) => updateField19({ jacketsFluores: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">F (Fluorescein)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.jacketsUhf}
                      onChange={(e) => updateField19({ jacketsUhf: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">U (UHF)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field19Data.jacketsVhf}
                      onChange={(e) => updateField19({ jacketsVhf: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">V (VHF)</span>
                  </label>
                </div>
              </div>

              {/* D/ Dinghies */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={field19Data.dinghiesEnabled}
                    onChange={(e) => updateField19({ dinghiesEnabled: e.target.checked })}
                    className="rounded border-slate-300"
                    id="dinghiesEnabled"
                  />
                  <label htmlFor="dinghiesEnabled" className="text-sm font-medium text-slate-700 cursor-pointer">
                    D/ Dinghies
                  </label>
                </div>
                {field19Data.dinghiesEnabled && (
                  <div className="ml-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Number</label>
                      <input
                        type="text"
                        value={field19Data.dinghiesNumber}
                        onChange={(e) => updateField19({ dinghiesNumber: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                        placeholder="01"
                        maxLength={2}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Capacity</label>
                      <input
                        type="text"
                        value={field19Data.dinghiesCapacity}
                        onChange={(e) => updateField19({ dinghiesCapacity: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                        placeholder="004"
                        maxLength={3}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-mono"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field19Data.dinghiesCover}
                          onChange={(e) => updateField19({ dinghiesCover: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm">C (Cover)</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Colour</label>
                      <input
                        type="text"
                        value={field19Data.dinghiesColour}
                        onChange={(e) => updateField19({ dinghiesColour: e.target.value.toUpperCase() })}
                        placeholder="YELLOW"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-mono uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* A/ Aircraft Colour */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  A/ Aircraft Colour and Markings
                </label>
                <input
                  type="text"
                  value={field19Data.aircraftColour}
                  onChange={(e) => updateField19({ aircraftColour: e.target.value.toUpperCase() })}
                  placeholder="WHITE WITH RED STRIPE"
                  maxLength={60}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                />
              </div>

              {/* N/ Remarks */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  N/ Remarks
                </label>
                <input
                  type="text"
                  value={field19Data.remarks}
                  onChange={(e) => updateField19({ remarks: e.target.value.toUpperCase() })}
                  placeholder="Optional remarks about survival equipment"
                  maxLength={60}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                />
              </div>

              {/* C/ Pilot in Command */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  C/ Pilot in Command
                </label>
                <input
                  type="text"
                  value={field19Data.pilotInCommand}
                  onChange={(e) => updateField19({ pilotInCommand: e.target.value.toUpperCase() })}
                  placeholder="PILOT NAME"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                />
              </div>

              {/* Generated string preview */}
              {formData.flSuplementary && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Generated Field 19:</p>
                  <code className="text-xs font-mono text-slate-700">{formData.flSuplementary}</code>
                </div>
              )}
            </div>
          </section>

          {/* Pilot Telephone */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Pilot Contact
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telephone Number
              </label>
              <input
                type="tel"
                value={formData.pilotTel || ''}
                onChange={(e) => handleInputChange('pilotTel', e.target.value)}
                placeholder="+31612345678"
                className="w-full md:w-1/2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </section>

          {/* Validation Result */}
          {validationResult && (
            <div
              className={`p-4 rounded-lg border ${
                validationResult.fplIsOk
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {validationResult.fplIsOk ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Flight plan is valid</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-medium">Validation failed</span>
                  </>
                )}
              </div>

              {/* Field-specific errors */}
              {validationResult.fieldErrors && validationResult.fieldErrors.length > 0 && (
                <div className="mt-3 space-y-2">
                  {validationResult.fieldErrors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm bg-red-100/50 rounded p-2">
                      <span className="font-semibold text-red-700 shrink-0">
                        {getReadableFieldName(err.field)}:
                      </span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* General error messages */}
              {validationResult.errorMessages && validationResult.errorMessages.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-sm">
                  {validationResult.errorMessages.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              )}

              {/* Show raw response for debugging when no errors found */}
              {!validationResult.fplIsOk &&
               !validationResult.fieldErrors?.length &&
               !validationResult.errorMessages?.length &&
               validationResult.rawResponse && (
                <details className="mt-3">
                  <summary className="text-sm cursor-pointer text-red-600 hover:text-red-800">
                    Show raw API response (debug)
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                    {validationResult.rawResponse}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Link
              href="/dashboard"
              className="px-6 py-3 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleValidate}
              disabled={validating}
              className="px-6 py-3 bg-slate-200 text-slate-800 rounded-lg font-medium hover:bg-slate-300 transition disabled:opacity-50"
            >
              {validating ? 'Validating...' : 'Validate'}
            </button>
            <button
              type="button"
              disabled={!validationResult?.fplIsOk}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              File Flight Plan
            </button>
          </div>
        </form>
      </main>

      {/* Field 18 Settings Modal */}
      <Field18SettingsModal
        isOpen={showField18Modal}
        onClose={() => setShowField18Modal(false)}
        onApply={handleField18Apply}
        initialData={field18Data}
      />

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSaveTemplateModal(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Save as Template</h2>
              <p className="text-sm text-slate-500 mt-1">
                Save current flight plan settings as a reusable template
              </p>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value.toUpperCase())}
                placeholder="e.g. PHHLR or MY TEMPLATE"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono"
                maxLength={20}
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                If a template with this name exists, it will be overwritten
              </p>
              {saveTemplateError && (
                <div className="mt-2">
                  <p className="text-sm text-red-600">{saveTemplateError}</p>
                  {saveTemplateRawResponse && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                        Show technical details
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-100 rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                        {saveTemplateRawResponse}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                disabled={savingTemplate}
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={savingTemplate || !saveTemplateName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {savingTemplate ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Template'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
