'use client';

import React, { useState } from 'react';
import { Zap, Heart, Activity } from 'lucide-react';

interface SampleEKGData {
  name: string;
  rhythm_classification: string;
  heart_rate: number;
  clinical_significance: 'normal' | 'monitor' | 'urgent' | 'critical';
  pathophysiology: string;
  clinical_context: {
    symptoms_likely: string[];
    treatment_considerations: string[];
    monitoring_requirements: string[];
  };
}

const sampleData: SampleEKGData[] = [
  {
    name: "Normal Sinus Rhythm",
    rhythm_classification: 'Normal Sinus Rhythm',
    heart_rate: 72,
    clinical_significance: 'normal',
    pathophysiology: "Normal sinus rhythm with coordinated electrical conduction from the SA node through the AV node to the ventricles, producing effective mechanical contractions.",
    clinical_context: {
      symptoms_likely: [],
      treatment_considerations: ["No treatment required", "Continue normal activity"],
      monitoring_requirements: ["Routine cardiac monitoring as appropriate"]
    }
  },
  {
    name: "Atrial Fibrillation",
    rhythm_classification: 'Atrial Fibrillation',
    heart_rate: 110,
    clinical_significance: 'urgent',
    pathophysiology: "Chaotic electrical activity in the atria leads to irregular, rapid ventricular response. The atria quiver rather than contract effectively, reducing cardiac output and increasing stroke risk.",
    clinical_context: {
      symptoms_likely: ["Palpitations", "Shortness of breath", "Fatigue", "Chest discomfort"],
      treatment_considerations: ["Anticoagulation", "Rate or rhythm control", "Cardioversion if indicated"],
      monitoring_requirements: ["Continuous cardiac monitoring", "INR monitoring if on warfarin"]
    }
  },
  {
    name: "Ventricular Tachycardia",
    rhythm_classification: 'Ventricular Tachycardia',
    heart_rate: 180,
    clinical_significance: 'critical',
    pathophysiology: "Rapid ventricular rhythm originating from ectopic ventricular focus. Results in poor ventricular filling and decreased cardiac output, potentially leading to hemodynamic instability.",
    clinical_context: {
      symptoms_likely: ["Syncope", "Chest pain", "Shortness of breath", "Cardiac arrest risk"],
      treatment_considerations: ["Immediate cardioversion if unstable", "IV antiarrhythmics", "Defibrillation if pulseless"],
      monitoring_requirements: ["Immediate intensive cardiac monitoring", "Prepare for emergency intervention"]
    }
  },
  {
    name: "Third Degree Heart Block",
    rhythm_classification: 'First Degree AV Block',
    heart_rate: 35,
    clinical_significance: 'urgent',
    pathophysiology: "Complete dissociation between atrial and ventricular activity. AV node fails to conduct impulses, leading to independent atrial and ventricular rhythms with slow ventricular escape.",
    clinical_context: {
      symptoms_likely: ["Fatigue", "Dizziness", "Syncope", "Exercise intolerance"],
      treatment_considerations: ["Pacemaker implantation", "Temporary pacing if symptomatic", "Atropine (limited effectiveness)"],
      monitoring_requirements: ["Continuous cardiac monitoring", "Monitor for hemodynamic compromise"]
    }
  },
  {
    name: "Sinus Bradycardia",
    rhythm_classification: 'Sinus Bradycardia',
    heart_rate: 45,
    clinical_significance: 'monitor',
    pathophysiology: "Normal sinus rhythm but with slow rate. May be physiological (athletes) or pathological (medications, hypothyroidism, increased ICP).",
    clinical_context: {
      symptoms_likely: ["May be asymptomatic", "Fatigue if symptomatic", "Dizziness"],
      treatment_considerations: ["Identify and treat underlying cause", "Atropine if symptomatic", "Consider pacing if severe"],
      monitoring_requirements: ["Monitor symptoms and hemodynamic status"]
    }
  }
];

interface SampleEKGDataProps {
  onSampleSelect: (data: SampleEKGData) => void;
  currentSample?: string;
}

export const SampleEKGDataSelector: React.FC<SampleEKGDataProps> = ({ onSampleSelect, currentSample }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleSampleChange = (index: number) => {
    setSelectedIndex(index);
    onSampleSelect(sampleData[index]);
  };

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="w-5 h-5 text-green-400" />
        <h3 className="font-semibold text-green-400">Sample EKG Data</h3>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-slate-300 mb-2">Select Rhythm Type:</label>
          <select
            value={selectedIndex}
            onChange={(e) => handleSampleChange(parseInt(e.target.value))}
            className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            {sampleData.map((sample, index) => (
              <option key={index} value={index}>
                {sample.name} ({sample.heart_rate} BPM)
              </option>
            ))}
          </select>
        </div>
        
        <div className="border-t border-slate-700/50 pt-3">
          <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
            sampleData[selectedIndex].clinical_significance === 'normal' ? 'bg-green-900/50 text-green-300' :
            sampleData[selectedIndex].clinical_significance === 'monitor' ? 'bg-yellow-900/50 text-yellow-300' :
            sampleData[selectedIndex].clinical_significance === 'urgent' ? 'bg-orange-900/50 text-orange-300' :
            'bg-red-900/50 text-red-300'
          }`}>
            <div className="flex items-center space-x-2 mb-1">
              <Zap className="w-4 h-4" />
              <span>{sampleData[selectedIndex].clinical_significance.toUpperCase()}</span>
            </div>
            <div className="text-xs opacity-80">
              {sampleData[selectedIndex].heart_rate} BPM • {sampleData[selectedIndex].rhythm_classification.replace('_', ' ')}
            </div>
          </div>
          
          <div className="mt-3 text-xs text-slate-400">
            <div className="font-medium text-slate-300 mb-1">Pathophysiology:</div>
            <div className="mb-3">{sampleData[selectedIndex].pathophysiology}</div>
            
            {sampleData[selectedIndex].clinical_context.symptoms_likely.length > 0 && (
              <div>
                <div className="font-medium text-slate-300">Common Symptoms:</div>
                <ul className="mt-1 space-y-1">
                  {sampleData[selectedIndex].clinical_context.symptoms_likely.slice(0, 3).map((symptom, idx) => (
                    <li key={idx}>• {symptom}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={() => handleSampleChange(selectedIndex)}
          className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center space-x-2"
        >
          <Heart className="w-4 h-4" />
          <span>Load This Rhythm</span>
        </button>
      </div>
    </div>
  );
};

export default SampleEKGDataSelector;