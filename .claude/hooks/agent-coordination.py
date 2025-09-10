#!/usr/bin/env python3
"""
Agent Coordination Hooks for EKG Clinical Simulation
Validates agent handoffs and ensures medical accuracy
"""

import json
import sys
from typing import Dict, Any, List

def validate_medical_output(medical_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate medical analysis output before 3D visualization"""
    
    required_fields = [
        "rhythm_classification",
        "heart_rate", 
        "conduction_timing",
        "clinical_significance",
        "chamber_coordination"
    ]
    
    missing_fields = []
    for field in required_fields:
        if field not in medical_data:
            missing_fields.append(field)
    
    if missing_fields:
        return {
            "status": "VALIDATION_FAILED",
            "error": f"Medical analysis missing required fields: {', '.join(missing_fields)}",
            "required_action": "regenerate_medical_analysis",
            "blocking": True
        }
    
    # Validate medical logic
    heart_rate = medical_data.get("heart_rate", 0)
    rhythm = medical_data.get("rhythm_classification", "")
    
    if heart_rate < 20 or heart_rate > 300:
        return {
            "status": "VALIDATION_FAILED", 
            "error": f"Invalid heart rate: {heart_rate} (must be 20-300 BPM)",
            "required_action": "correct_heart_rate",
            "blocking": True
        }
    
    if rhythm not in ["normal_sinus", "atrial_fibrillation", "ventricular_tachycardia", 
                     "heart_block", "sinus_bradycardia", "sinus_tachycardia"]:
        return {
            "status": "VALIDATION_FAILED",
            "error": f"Unknown rhythm classification: {rhythm}",
            "required_action": "correct_rhythm_classification", 
            "blocking": True
        }
    
    return {"status": "VALIDATION_PASSED"}

def validate_3d_medical_sync(medical_data: Dict[str, Any], 
                            visual_config: Dict[str, Any]) -> Dict[str, Any]:
    """Validate 3D animation synchronization with medical analysis"""
    
    # Check timing synchronization
    medical_cycle = medical_data.get("conduction_timing", {}).get("cardiac_cycle_ms", 0)
    visual_cycle = visual_config.get("animation_timing", {}).get("cycle_duration_ms", 0)
    
    timing_tolerance = 50  # 50ms tolerance
    if abs(medical_cycle - visual_cycle) > timing_tolerance:
        return {
            "status": "VALIDATION_FAILED",
            "error": f"Animation cycle ({visual_cycle}ms) doesn't match medical cycle ({medical_cycle}ms)",
            "required_action": "adjust_animation_timing",
            "blocking": True
        }
    
    # Validate conduction pathway accuracy
    medical_conduction = medical_data.get("conduction_timing", {})
    visual_conduction = visual_config.get("electrical_sequence", {})
    
    if "sa_to_av_delay" in medical_conduction and "sa_to_av_delay" in visual_conduction:
        medical_delay = medical_conduction["sa_to_av_delay"]
        visual_delay = visual_conduction["sa_to_av_delay"]
        
        if abs(medical_delay - visual_delay) > 20:  # 20ms tolerance
            return {
                "status": "VALIDATION_FAILED",
                "error": f"SA-AV conduction delay mismatch: medical={medical_delay}ms, visual={visual_delay}ms",
                "required_action": "correct_conduction_timing",
                "blocking": True
            }
    
    return {"status": "VALIDATION_PASSED"}

def validate_educational_accuracy(medical_data: Dict[str, Any],
                                educational_content: Dict[str, Any]) -> Dict[str, Any]:
    """Validate educational content matches medical findings"""
    
    clinical_significance = medical_data.get("clinical_significance", "")
    key_points = educational_content.get("key_teaching_points", [])
    
    # Critical findings must be emphasized in education
    if clinical_significance == "critical":
        urgent_keywords = ["urgent", "emergency", "immediate", "critical"]
        has_urgent = any(keyword in " ".join(key_points).lower() for keyword in urgent_keywords)
        
        if not has_urgent:
            return {
                "status": "VALIDATION_FAILED",
                "error": "Critical medical finding not properly emphasized in educational content",
                "required_action": "emphasize_critical_findings",
                "blocking": True
            }
    
    # Check rhythm explanation accuracy
    rhythm = medical_data.get("rhythm_classification", "")
    explanations = educational_content.get("rhythm_explanation", "")
    
    rhythm_keywords = {
        "atrial_fibrillation": ["irregular", "fibrillation", "atrial"],
        "ventricular_tachycardia": ["ventricular", "tachycardia", "wide"],
        "heart_block": ["block", "conduction", "delay"]
    }
    
    if rhythm in rhythm_keywords:
        required_keywords = rhythm_keywords[rhythm]
        explanation_text = explanations.lower()
        missing_keywords = [kw for kw in required_keywords if kw not in explanation_text]
        
        if missing_keywords:
            return {
                "status": "VALIDATION_FAILED",
                "error": f"Educational explanation missing key concepts for {rhythm}: {missing_keywords}",
                "required_action": "improve_rhythm_explanation",
                "blocking": True
            }
    
    return {"status": "VALIDATION_PASSED"}

def main():
    """Main hook entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({"status": "ERROR", "error": "No event data provided"}))
        return
    
    try:
        event_data = json.loads(sys.argv[1])
        agent_name = event_data.get("agent", "")
        result_data = event_data.get("result", {})
        context = event_data.get("shared_context", {})
        
        if agent_name == "medical-foundation":
            validation_result = validate_medical_output(result_data)
            
        elif agent_name == "3d-visualization":
            medical_context = context.get("medical", {})
            validation_result = validate_3d_medical_sync(medical_context, result_data)
            
        elif agent_name == "educational-content":
            medical_context = context.get("medical", {})
            validation_result = validate_educational_accuracy(medical_context, result_data)
            
        else:
            validation_result = {"status": "VALIDATION_PASSED"}
        
        print(json.dumps(validation_result))
        
    except Exception as e:
        print(json.dumps({
            "status": "ERROR",
            "error": f"Hook validation failed: {str(e)}"
        }))

if __name__ == "__main__":
    main()