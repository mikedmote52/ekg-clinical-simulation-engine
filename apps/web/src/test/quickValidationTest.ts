/**
 * Quick validation test to ensure the enhanced EKG analysis system is working
 */

import { ekgAnalyzer } from '../lib/ekgAnalysis';
import { createTestEKGFile } from './createTestEKG';

/**
 * Run a quick test to validate the enhanced system
 */
export async function runQuickValidationTest(): Promise<boolean> {
  console.log('🚀 Running quick validation test...');
  
  try {
    // Test 1: Normal Sinus Rhythm
    console.log('📊 Testing Normal Sinus Rhythm...');
    const normalFile = await createTestEKGFile('normal');
    const normalResult = await ekgAnalyzer.analyzeEKGFile(normalFile);
    
    const normalTest = normalResult.rhythm_analysis.primary_rhythm.toLowerCase().includes('sinus');
    console.log(`✅ Normal rhythm test: ${normalTest ? 'PASS' : 'FAIL'}`);
    console.log(`   Detected: ${normalResult.rhythm_analysis.primary_rhythm}`);
    console.log(`   Heart Rate: ${normalResult.rhythm_analysis.heart_rate} BPM`);
    console.log(`   Confidence: ${(normalResult.confidence_score * 100).toFixed(1)}%`);
    
    // Test 2: Atrial Fibrillation
    console.log('📊 Testing Atrial Fibrillation...');
    const afibFile = await createTestEKGFile('afib');
    const afibResult = await ekgAnalyzer.analyzeEKGFile(afibFile);
    
    const afibTest = afibResult.rhythm_analysis.primary_rhythm.toLowerCase().includes('fibrillation');
    console.log(`✅ Atrial fibrillation test: ${afibTest ? 'PASS' : 'FAIL'}`);
    console.log(`   Detected: ${afibResult.rhythm_analysis.primary_rhythm}`);
    console.log(`   Heart Rate: ${afibResult.rhythm_analysis.heart_rate} BPM`);
    console.log(`   Confidence: ${(afibResult.confidence_score * 100).toFixed(1)}%`);
    
    // Test 3: Ventricular Tachycardia
    console.log('📊 Testing Ventricular Tachycardia...');
    const vtachFile = await createTestEKGFile('vtach');
    const vtachResult = await ekgAnalyzer.analyzeEKGFile(vtachFile);
    
    const vtachTest = vtachResult.rhythm_analysis.primary_rhythm.toLowerCase().includes('tachycardia');
    console.log(`✅ Ventricular tachycardia test: ${vtachTest ? 'PASS' : 'FAIL'}`);
    console.log(`   Detected: ${vtachResult.rhythm_analysis.primary_rhythm}`);
    console.log(`   Heart Rate: ${vtachResult.rhythm_analysis.heart_rate} BPM`);
    console.log(`   Confidence: ${(vtachResult.confidence_score * 100).toFixed(1)}%`);
    
    const overallSuccess = normalTest && afibTest && vtachTest;
    console.log(`\n🎯 Overall Test Result: ${overallSuccess ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    return overallSuccess;
    
  } catch (error) {
    console.error('❌ Quick validation test failed:', error);
    return false;
  }
}

// Self-executing test when run directly
if (typeof window === 'undefined' && require.main === module) {
  runQuickValidationTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}