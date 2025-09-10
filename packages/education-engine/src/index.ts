import { MedicalAnalysis, EducationalContent } from '@ekg-sim/medical-types';

export interface LearningLevel {
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  description: string;
}

export interface ContentModule {
  id: string;
  title: string;
  content: string;
  level: LearningLevel['level'];
  duration_minutes: number;
}

export async function generateEducationalContent(
  analysis: MedicalAnalysis,
  userLevel: LearningLevel['level'] = 'intermediate'
): Promise<EducationalContent> {
  console.log(`Generating educational content for ${analysis.rhythm_classification} at ${userLevel} level`);
  
  // Simulate content generation
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    complexity_level: userLevel === 'expert' ? 'advanced' : userLevel === 'beginner' ? 'beginner' : 'intermediate',
    key_teaching_points: [
      `Rhythm: ${analysis.rhythm_classification.replace('_', ' ')}`,
      `Heart rate: ${analysis.heart_rate} bpm`,
      `Clinical significance: ${analysis.clinical_significance}`
    ],
    rhythm_explanation: `This EKG shows ${analysis.rhythm_classification.replace('_', ' ')} with a heart rate of ${analysis.heart_rate} bpm. ${analysis.pathophysiology}`,
    clinical_significance_explanation: `The clinical significance is ${analysis.clinical_significance}. This requires ${analysis.clinical_context.monitoring_requirements.join(', ')}.`,
    narration_timing: [
      {
        timestamp_ms: 0,
        content: `Let's analyze this ${analysis.rhythm_classification.replace('_', ' ')} rhythm`,
        emphasis_level: 'important' as const
      },
      {
        timestamp_ms: 2000,
        content: `Notice the heart rate of ${analysis.heart_rate} beats per minute`,
        emphasis_level: 'normal' as const
      },
      {
        timestamp_ms: 4000,
        content: analysis.pathophysiology,
        emphasis_level: 'normal' as const
      }
    ],
    interactive_elements: [
      {
        type: 'quiz' as const,
        trigger_time: 6000,
        content: {
          question: 'What is the heart rate?',
          answer: `${analysis.heart_rate} bpm`
        }
      }
    ],
    accessibility: {
      audio_description: `EKG rhythm analysis showing ${analysis.rhythm_classification}`,
      captions: true,
      high_contrast: false,
      screen_reader_compatible: true
    },
    learning_progression: {
      prerequisite_concepts: userLevel === 'beginner' ? ['Basic cardiac anatomy', 'EKG basics'] : ['Intermediate EKG interpretation'],
      next_level_concepts: ['Advanced rhythm analysis', 'Pathophysiology correlation'],
      mastery_indicators: ['Correctly identifies rhythm', 'Explains clinical significance']
    }
  };
}

export default {
  generateEducationalContent
};