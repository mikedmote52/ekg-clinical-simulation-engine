#!/usr/bin/env python3
"""
Medical Orchestrator Agent - Coordinates all specialized agents
Ensures proper sequencing, validation, and medical accuracy throughout the system
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime
import subprocess
import sys

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class AgentResult:
    """Standardized result from any agent"""
    agent_name: str
    status: str
    data: Dict[str, Any]
    validation_score: float
    timestamp: str
    errors: List[str]

@dataclass 
class ValidationResult:
    """Result from validation hooks"""
    status: str
    blocking: bool
    error: Optional[str] = None
    required_action: Optional[str] = None
    medical_accuracy_score: Optional[float] = None

class MedicalOrchestrator:
    """
    Orchestrates all specialized agents in the correct sequence
    with validation gates between each step
    """
    
    def __init__(self):
        self.shared_context = {}
        self.agent_results = {}
        self.validation_history = []
        self.session_id = f"session_{int(datetime.now().timestamp())}"
        
    async def coordinate_simulation(self, ekg_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main coordination function - orchestrates complete EKG simulation pipeline
        """
        logger.info(f"Starting EKG simulation coordination - Session: {self.session_id}")
        
        try:
            # Initialize shared context
            self.shared_context = {
                "session_id": self.session_id,
                "timestamp": datetime.now().isoformat(),
                "input_data": ekg_input,
                "medical": {},
                "visualization": {},
                "education": {},
                "interface": {},
                "validation_status": {
                    "medical_accuracy": False,
                    "visual_sync": False, 
                    "educational_accuracy": False,
                    "integration_complete": False
                }
            }
            
            # Step 1: Medical Analysis (Foundation)
            medical_result = await self.run_medical_analysis(ekg_input)
            validation_1 = await self.validate_medical_output(medical_result)
            
            if validation_1.blocking and validation_1.status != "VALIDATION_PASSED":
                return self.create_error_response("Medical analysis validation failed", validation_1)
            
            # Step 2: 3D Visualization (Depends on medical analysis)
            visual_result = await self.run_3d_visualization(medical_result)
            validation_2 = await self.validate_visual_medical_sync(medical_result, visual_result)
            
            if validation_2.blocking and validation_2.status != "VALIDATION_PASSED":
                return self.create_error_response("3D visualization validation failed", validation_2)
            
            # Step 3: Educational Content (Depends on medical + visual)
            education_result = await self.run_educational_content(medical_result, visual_result)
            validation_3 = await self.validate_educational_accuracy(medical_result, education_result)
            
            if validation_3.blocking and validation_3.status != "VALIDATION_PASSED":
                return self.create_error_response("Educational content validation failed", validation_3)
            
            # Step 4: Frontend Integration (Combines all previous results)
            interface_result = await self.run_frontend_integration(
                medical_result, visual_result, education_result
            )
            
            # Final integration validation
            final_validation = await self.validate_complete_integration(
                medical_result, visual_result, education_result, interface_result
            )
            
            if final_validation.blocking and final_validation.status != "VALIDATION_PASSED":
                return self.create_error_response("Final integration validation failed", final_validation)
            
            # Success - return integrated result
            return self.create_success_response(
                medical_result, visual_result, education_result, interface_result
            )
            
        except Exception as e:
            logger.error(f"Orchestration failed: {str(e)}")
            return self.create_error_response(f"Orchestration error: {str(e)}", None)
    
    async def run_medical_analysis(self, ekg_input: Dict[str, Any]) -> AgentResult:
        """Run the medical analysis agent"""
        logger.info("Running medical analysis agent...")
        
        # Simulated medical analysis agent call
        # In production, this would call the actual Claude Code agent
        try:
            # Medical analysis logic would go here
            medical_data = await self.simulate_medical_agent(ekg_input)
            
            result = AgentResult(
                agent_name="medical-foundation",
                status="SUCCESS",
                data=medical_data,
                validation_score=0.95,
                timestamp=datetime.now().isoformat(),
                errors=[]
            )
            
            self.shared_context["medical"] = medical_data
            self.agent_results["medical"] = result
            
            logger.info("Medical analysis completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Medical analysis failed: {str(e)}")
            return AgentResult(
                agent_name="medical-foundation",
                status="FAILED",
                data={},
                validation_score=0.0,
                timestamp=datetime.now().isoformat(),
                errors=[str(e)]
            )
    
    async def simulate_medical_agent(self, ekg_input: Dict[str, Any]) -> Dict[str, Any]:
        """Simulated medical analysis - replace with actual agent call"""
        
        # This is a simulation - in production would call Claude Code agent
        return {
            "rhythm_classification": "normal_sinus",
            "heart_rate": 72,
            "conduction_timing": {
                "sa_to_av_delay": 120,
                "av_to_his_delay": 50,
                "his_to_purkinje_delay": 40,
                "cardiac_cycle_ms": 833,  # 72 BPM = 833ms cycle
                "qrs_duration": 95,
                "qt_interval": 380
            },
            "clinical_significance": "normal",
            "chamber_coordination": {
                "atrial_contraction": True,
                "ventricular_contraction": True,
                "av_synchrony": True,
                "sequential_activation": True
            },
            "intervals": {
                "pr_interval": 160,
                "qrs_width": 95,
                "qt_corrected": 420,
                "rr_interval": 833
            },
            "pathophysiology": "Normal sinus rhythm with regular atrial and ventricular activation",
            "clinical_context": {
                "symptoms_likely": [],
                "treatment_considerations": ["No treatment required"],
                "monitoring_requirements": ["Routine monitoring appropriate"]
            }
        }
    
    async def run_3d_visualization(self, medical_result: AgentResult) -> AgentResult:
        """Run the 3D visualization agent"""
        logger.info("Running 3D visualization agent...")
        
        try:
            medical_data = medical_result.data
            visual_data = await self.simulate_3d_agent(medical_data)
            
            result = AgentResult(
                agent_name="3d-visualization",
                status="SUCCESS",
                data=visual_data,
                validation_score=0.92,
                timestamp=datetime.now().isoformat(),
                errors=[]
            )
            
            self.shared_context["visualization"] = visual_data
            self.agent_results["visualization"] = result
            
            logger.info("3D visualization completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"3D visualization failed: {str(e)}")
            return AgentResult(
                agent_name="3d-visualization",
                status="FAILED",
                data={},
                validation_score=0.0,
                timestamp=datetime.now().isoformat(),
                errors=[str(e)]
            )
    
    async def simulate_3d_agent(self, medical_data: Dict[str, Any]) -> Dict[str, Any]:
        """Simulated 3D visualization agent - replace with actual agent call"""
        
        cycle_duration = medical_data["conduction_timing"]["cardiac_cycle_ms"]
        
        return {
            "animation_timing": {
                "cycle_duration_ms": cycle_duration,
                "electrical_sequence": {
                    "sa_activation": 0,
                    "atrial_depolarization": 50,
                    "av_conduction": medical_data["conduction_timing"]["sa_to_av_delay"],
                    "ventricular_depolarization": medical_data["conduction_timing"]["sa_to_av_delay"] + 50,
                    "repolarization": cycle_duration - 200
                },
                "mechanical_sequence": {
                    "atrial_systole": 100,
                    "isovolumic_contraction": 150,
                    "ventricular_ejection": 250,
                    "isovolumic_relaxation": 550,
                    "ventricular_filling": 600
                },
                "speed_multiplier": 1.0
            },
            "conduction_path": {
                "coordinates": [
                    {"x": 0, "y": 10, "z": 0},   # SA node
                    {"x": 5, "y": 0, "z": 0},    # AV node  
                    {"x": 0, "y": -5, "z": 0},   # His bundle
                    {"x": -5, "y": -10, "z": 2}, # Left bundle
                    {"x": 5, "y": -10, "z": -2}  # Right bundle
                ],
                "activation_sequence": [0, 50, 120, 170, 170],
                "color_progression": ["red", "orange", "yellow", "green", "blue"]
            },
            "chamber_contraction": {
                "atrial_contraction_intensity": 0.6,
                "ventricular_contraction_intensity": 1.0,
                "wall_motion_pattern": "normal"
            },
            "viewing_config": {
                "default_camera_position": {"x": 0, "y": 0, "z": 20},
                "educational_viewpoints": [
                    {
                        "name": "Anterior View",
                        "position": {"x": 0, "y": 0, "z": 20},
                        "target": {"x": 0, "y": 0, "z": 0},
                        "description": "Front view showing ventricular activity"
                    },
                    {
                        "name": "Electrical System",
                        "position": {"x": 10, "y": 10, "z": 15},
                        "target": {"x": 0, "y": 0, "z": 0},
                        "description": "Angled view highlighting conduction system"
                    }
                ]
            },
            "rendering": {
                "quality_level": "high",
                "target_fps": 60,
                "anti_aliasing": True,
                "shadows": True
            }
        }
    
    async def run_educational_content(self, medical_result: AgentResult, 
                                    visual_result: AgentResult) -> AgentResult:
        """Run the educational content agent"""
        logger.info("Running educational content agent...")
        
        try:
            education_data = await self.simulate_education_agent(
                medical_result.data, visual_result.data
            )
            
            result = AgentResult(
                agent_name="educational-content",
                status="SUCCESS", 
                data=education_data,
                validation_score=0.94,
                timestamp=datetime.now().isoformat(),
                errors=[]
            )
            
            self.shared_context["education"] = education_data
            self.agent_results["education"] = result
            
            logger.info("Educational content completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Educational content failed: {str(e)}")
            return AgentResult(
                agent_name="educational-content",
                status="FAILED",
                data={},
                validation_score=0.0,
                timestamp=datetime.now().isoformat(),
                errors=[str(e)]
            )
    
    async def simulate_education_agent(self, medical_data: Dict[str, Any], 
                                     visual_data: Dict[str, Any]) -> Dict[str, Any]:
        """Simulated educational agent - replace with actual agent call"""
        
        rhythm = medical_data["rhythm_classification"]
        
        return {
            "complexity_level": "intermediate",
            "key_teaching_points": [
                "Normal sinus rhythm originates from the SA node",
                "Electrical impulses follow the conduction system pathway", 
                "Regular atrial and ventricular contractions maintain cardiac output",
                "Normal heart rate range is 60-100 beats per minute"
            ],
            "rhythm_explanation": f"This EKG shows {rhythm.replace('_', ' ')} with regular P waves, normal PR interval, and consistent QRS complexes. The electrical activity follows the normal conduction pathway from SA node through AV node to the ventricular conduction system.",
            "clinical_significance_explanation": "This rhythm indicates normal cardiac electrical activity with no immediate concerns. Regular monitoring and maintenance of cardiovascular health is recommended.",
            "narration_timing": [
                {
                    "timestamp_ms": 0,
                    "content": "This EKG shows normal sinus rhythm beginning with SA node activation.",
                    "emphasis_level": "normal",
                    "visual_highlight": "sa_node"
                },
                {
                    "timestamp_ms": 200,
                    "content": "Notice the electrical impulse spreading through the atria, creating the P wave.",
                    "emphasis_level": "important", 
                    "visual_highlight": "atrial_activation"
                },
                {
                    "timestamp_ms": 400,
                    "content": "The impulse reaches the AV node, where it pauses briefly before entering the ventricles.",
                    "emphasis_level": "important",
                    "visual_highlight": "av_node"
                }
            ],
            "interactive_elements": [
                {
                    "type": "highlight",
                    "trigger_time": 100,
                    "content": {"highlight_region": "sa_node", "duration": 2000}
                },
                {
                    "type": "annotation",
                    "trigger_time": 300,
                    "content": {"text": "AV Node Delay", "position": "av_node"}
                }
            ],
            "accessibility": {
                "audio_description": "Heart animation showing normal electrical conduction with synchronized chamber contractions",
                "captions": True,
                "high_contrast": False,
                "screen_reader_compatible": True
            },
            "learning_progression": {
                "prerequisite_concepts": ["basic_cardiac_anatomy", "electrical_conduction"],
                "next_level_concepts": ["arrhythmia_recognition", "pathological_rhythms"],
                "mastery_indicators": ["rhythm_identification", "timing_understanding"]
            }
        }
    
    async def run_frontend_integration(self, medical_result: AgentResult,
                                     visual_result: AgentResult,
                                     education_result: AgentResult) -> AgentResult:
        """Run the frontend integration agent"""
        logger.info("Running frontend integration agent...")
        
        try:
            interface_data = await self.simulate_frontend_agent(
                medical_result.data, visual_result.data, education_result.data
            )
            
            result = AgentResult(
                agent_name="frontend-integration",
                status="SUCCESS",
                data=interface_data,
                validation_score=0.91,
                timestamp=datetime.now().isoformat(),
                errors=[]
            )
            
            self.shared_context["interface"] = interface_data
            self.agent_results["frontend"] = result
            
            logger.info("Frontend integration completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Frontend integration failed: {str(e)}")
            return AgentResult(
                agent_name="frontend-integration", 
                status="FAILED",
                data={},
                validation_score=0.0,
                timestamp=datetime.now().isoformat(),
                errors=[str(e)]
            )
    
    async def simulate_frontend_agent(self, medical_data: Dict[str, Any],
                                    visual_data: Dict[str, Any],
                                    education_data: Dict[str, Any]) -> Dict[str, Any]:
        """Simulated frontend agent - replace with actual agent call"""
        
        return {
            "input_configuration": {
                "supported_formats": ["image", "waveform", "text_report"],
                "upload_validation": True,
                "real_time_processing": True
            },
            "controls": {
                "play_pause": True,
                "speed_control": {"min": 0.1, "max": 5.0, "step": 0.1},
                "educational_mode_toggle": True,
                "view_angle_control": True,
                "annotation_toggle": True
            },
            "display": {
                "ekg_trace_overlay": True,
                "timing_indicators": True,
                "educational_annotations": True,
                "progress_tracker": True
            },
            "responsive": {
                "mobile_optimized": True,
                "tablet_layout": True,
                "desktop_enhanced": True
            }
        }
    
    async def validate_medical_output(self, medical_result: AgentResult) -> ValidationResult:
        """Validate medical analysis output"""
        logger.info("Validating medical analysis output...")
        
        try:
            # Call validation hook
            hook_result = await self.call_validation_hook("medical-foundation", medical_result.data)
            
            if hook_result["status"] == "VALIDATION_PASSED":
                self.shared_context["validation_status"]["medical_accuracy"] = True
                return ValidationResult(
                    status="VALIDATION_PASSED",
                    blocking=False,
                    medical_accuracy_score=medical_result.validation_score
                )
            else:
                return ValidationResult(
                    status="VALIDATION_FAILED",
                    blocking=hook_result.get("blocking", True),
                    error=hook_result.get("error"),
                    required_action=hook_result.get("required_action")
                )
                
        except Exception as e:
            logger.error(f"Medical validation failed: {str(e)}")
            return ValidationResult(
                status="VALIDATION_FAILED",
                blocking=True,
                error=f"Validation error: {str(e)}"
            )
    
    async def validate_visual_medical_sync(self, medical_result: AgentResult,
                                         visual_result: AgentResult) -> ValidationResult:
        """Validate 3D visualization synchronization with medical data"""
        logger.info("Validating 3D visualization medical synchronization...")
        
        try:
            # Call validation hook with both medical and visual data
            hook_data = {
                "agent": "3d-visualization",
                "result": visual_result.data,
                "shared_context": {"medical": medical_result.data}
            }
            
            hook_result = await self.call_validation_hook_with_context(hook_data)
            
            if hook_result["status"] == "VALIDATION_PASSED":
                self.shared_context["validation_status"]["visual_sync"] = True
                return ValidationResult(status="VALIDATION_PASSED", blocking=False)
            else:
                return ValidationResult(
                    status="VALIDATION_FAILED",
                    blocking=hook_result.get("blocking", True),
                    error=hook_result.get("error"),
                    required_action=hook_result.get("required_action")
                )
                
        except Exception as e:
            logger.error(f"Visual sync validation failed: {str(e)}")
            return ValidationResult(
                status="VALIDATION_FAILED",
                blocking=True,
                error=f"Visual sync validation error: {str(e)}"
            )
    
    async def validate_educational_accuracy(self, medical_result: AgentResult,
                                          education_result: AgentResult) -> ValidationResult:
        """Validate educational content accuracy"""
        logger.info("Validating educational content accuracy...")
        
        try:
            hook_data = {
                "agent": "educational-content",
                "result": education_result.data,
                "shared_context": {"medical": medical_result.data}
            }
            
            hook_result = await self.call_validation_hook_with_context(hook_data)
            
            if hook_result["status"] == "VALIDATION_PASSED":
                self.shared_context["validation_status"]["educational_accuracy"] = True
                return ValidationResult(status="VALIDATION_PASSED", blocking=False)
            else:
                return ValidationResult(
                    status="VALIDATION_FAILED",
                    blocking=hook_result.get("blocking", True),
                    error=hook_result.get("error"),
                    required_action=hook_result.get("required_action")
                )
                
        except Exception as e:
            logger.error(f"Educational accuracy validation failed: {str(e)}")
            return ValidationResult(
                status="VALIDATION_FAILED",
                blocking=True,
                error=f"Educational validation error: {str(e)}"
            )
    
    async def validate_complete_integration(self, medical_result: AgentResult,
                                          visual_result: AgentResult,
                                          education_result: AgentResult,
                                          interface_result: AgentResult) -> ValidationResult:
        """Final validation of complete system integration"""
        logger.info("Performing final integration validation...")
        
        try:
            # Check that all components are compatible
            all_validations_passed = all([
                self.shared_context["validation_status"]["medical_accuracy"],
                self.shared_context["validation_status"]["visual_sync"],
                self.shared_context["validation_status"]["educational_accuracy"]
            ])
            
            if all_validations_passed:
                self.shared_context["validation_status"]["integration_complete"] = True
                logger.info("Complete integration validation passed")
                return ValidationResult(status="VALIDATION_PASSED", blocking=False)
            else:
                return ValidationResult(
                    status="VALIDATION_FAILED",
                    blocking=True,
                    error="Not all component validations passed",
                    required_action="Fix component validation failures"
                )
                
        except Exception as e:
            logger.error(f"Integration validation failed: {str(e)}")
            return ValidationResult(
                status="VALIDATION_FAILED",
                blocking=True,
                error=f"Integration validation error: {str(e)}"
            )
    
    async def call_validation_hook(self, agent_name: str, agent_data: Dict[str, Any]) -> Dict[str, Any]:
        """Call validation hook for agent output"""
        try:
            hook_data = {
                "agent": agent_name,
                "result": agent_data,
                "shared_context": self.shared_context
            }
            
            # Call the validation hook
            result = subprocess.run([
                "python3",
                "./.claude/hooks/agent-coordination.py",
                json.dumps(hook_data)
            ], capture_output=True, text=True, cwd=".")
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                logger.error(f"Hook validation failed: {result.stderr}")
                return {"status": "VALIDATION_FAILED", "error": result.stderr}
                
        except Exception as e:
            logger.error(f"Hook call failed: {str(e)}")
            return {"status": "VALIDATION_FAILED", "error": str(e)}
    
    async def call_validation_hook_with_context(self, hook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Call validation hook with full context"""
        try:
            # Call the validation hook
            result = subprocess.run([
                "python3", 
                "./.claude/hooks/agent-coordination.py",
                json.dumps(hook_data)
            ], capture_output=True, text=True, cwd=".")
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                logger.error(f"Hook validation failed: {result.stderr}")
                return {"status": "VALIDATION_FAILED", "error": result.stderr}
                
        except Exception as e:
            logger.error(f"Hook call failed: {str(e)}")
            return {"status": "VALIDATION_FAILED", "error": str(e)}
    
    def create_success_response(self, medical_result: AgentResult,
                               visual_result: AgentResult,
                               education_result: AgentResult,
                               interface_result: AgentResult) -> Dict[str, Any]:
        """Create successful orchestration response"""
        
        return {
            "status": "SUCCESS",
            "session_id": self.session_id,
            "timestamp": datetime.now().isoformat(),
            "shared_context": self.shared_context,
            "agent_results": {
                "medical": asdict(medical_result),
                "visualization": asdict(visual_result),
                "education": asdict(education_result),
                "interface": asdict(interface_result)
            },
            "validation_history": self.validation_history,
            "medical_accuracy_score": sum([
                medical_result.validation_score,
                visual_result.validation_score, 
                education_result.validation_score,
                interface_result.validation_score
            ]) / 4,
            "ready_for_deployment": True
        }
    
    def create_error_response(self, error_message: str, 
                            validation_result: Optional[ValidationResult]) -> Dict[str, Any]:
        """Create error response"""
        
        return {
            "status": "FAILED",
            "session_id": self.session_id,
            "timestamp": datetime.now().isoformat(),
            "error": error_message,
            "validation_failure": asdict(validation_result) if validation_result else None,
            "shared_context": self.shared_context,
            "agent_results": {k: asdict(v) for k, v in self.agent_results.items()},
            "ready_for_deployment": False
        }

async def main():
    """Main entry point for orchestrator"""
    
    # Sample EKG input for testing
    sample_ekg_input = {
        "type": "text_report",
        "data": "Normal sinus rhythm, Rate 72 bpm, PR interval 160ms, QRS 95ms",
        "timestamp": datetime.now().isoformat()
    }
    
    orchestrator = MedicalOrchestrator()
    result = await orchestrator.coordinate_simulation(sample_ekg_input)
    
    print(json.dumps(result, indent=2))
    
    return result

if __name__ == "__main__":
    asyncio.run(main())