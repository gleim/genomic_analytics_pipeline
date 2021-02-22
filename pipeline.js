// this file executes a pipeline that sequentially performs:
//   1. genome read sequences alignment
//   2. sort the aligned data
//   3. call variants on the sorted aligned sequence data
// dependencies are declared here
const { vcfToJSON } = require("vcftojson");
const { spawn } = require("child_process");
const {plot, Plot } = require("nodeplotlib");
const fs = require('fs');
// constant string references are declared and defined here
const READS_FILE_PATH = "tiny-test-data/wgs/"
const REF_FILE_PATH = "../genomes/Hsapiens/hg19/seq/"
const REFERENCE_FA_FILE = "hg19.fa"
const COMPRESSED_READS_FILE_ONE = "mt_1.fq.gz"
const COMPRESSED_READS_FILE_TWO = "mt_2.fq.gz"
const ORIGINAL_SAM_FILE = "sample.sam"
const SORTED_SAM_FILE = "sample-s.sam"
const ORIGINAL_COMPRESSED_VCF_FILE = "in.vcf.gz"
const RESULT_VCF_FILE = "result.vcf"
const RESULT_JSON_FILE = "result.json"
const VARIANT_CALLING_FLAGS = "-Ou"
const VARIANT_CALLING_FLAGS_2 = "-vmO"
const FASTA_REF_FLAG = "--fasta-ref"
const FILETYPE_FLAG = "v"
let sam = fs.createWriteStream(ORIGINAL_SAM_FILE);
let sorted_sam = fs.createWriteStream(SORTED_SAM_FILE);
let original_compressed_vcf_file = fs.createWriteStream(ORIGINAL_COMPRESSED_VCF_FILE);
let result_vcf_file = fs.createWriteStream(RESULT_VCF_FILE);
let result_json_file = fs.createWriteStream(RESULT_JSON_FILE);
// function definitions are provided here below
// index FASTA reference file and FASTQ reads
function index_reads() {
        console.log(REF_FILE_PATH+REFERENCE_FA_FILE);
        console.log(COMPRESSED_READS_FILE_ONE);
        console.log(COMPRESSED_READS_FILE_TWO);
  const bwa_thread = spawn("bwa", ["index", REF_FILE_PATH+REFERENCE_FA_FILE, COMPRESSED_READS_FILE_ONE, COMPRESSED_READS_FILE_TWO]);
  bwa_thread.stdout.on("data", data => {
    console.log(`stdout: ${data}`);
  });
  bwa_thread.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
  });
  bwa_thread.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });
  bwa_thread.on("close", code => {
    console.log(`child process exited with code ${code}`);
    console.log(`calling align_reads()`);
    align_reads();
  });
}
// creates SAM from FASTA reference file and FASTQ reads
function align_reads() {
        console.log(REF_FILE_PATH+REFERENCE_FA_FILE);
        console.log(COMPRESSED_READS_FILE_ONE);
        console.log(COMPRESSED_READS_FILE_TWO);
  const bwa_thread = spawn("bwa", ["mem", REF_FILE_PATH+REFERENCE_FA_FILE, COMPRESSED_READS_FILE_ONE, COMPRESSED_READS_FILE_TWO]);
  bwa_thread.stdout.on("data", data => {
    console.log(`stdout: ${data}`);
    sam.write(data);
  });
  bwa_thread.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
  });
  bwa_thread.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });
  bwa_thread.on("close", code => {
    sam.close();
    console.log(`child process exited with code ${code}`);
    console.log(`calling sort_alignment()`);
    sort_alignment();
  });
}
// creates sorted SAM from original SAM
function sort_alignment() {
console.log("Sorting Alignment from " + ORIGINAL_SAM_FILE);
  const sort_thread = spawn("samtools", ["sort", ORIGINAL_SAM_FILE]);
  sort_thread.stdout.on("data", data => {
    //console.log(`stdout: ${data}`);
    sorted_sam.write(data);
  });
  sort_thread.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
  });
  sort_thread.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });
  sort_thread.on("close", code => {
    console.log(`child process exited with code ${code}`);
    sorted_sam.close();
    call_variants_1();
  });
}
// creates VCF from sorted SAM
function call_variants_1() {
  console.log("Calling Variants from " + SORTED_SAM_FILE);
  const vcf_creation_thread = spawn("bcftools", ["mpileup", VARIANT_CALLING_FLAGS, FASTA_REF_FLAG, REF_FILE_PATH+REFERENCE_FA_FILE, SORTED_SAM_FILE]);
  vcf_creation_thread.stdout.on("data", data => {
    console.log(`stdout: ${data}`);
    original_compressed_vcf_file.write(data);
  });
  vcf_creation_thread.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
  });
  vcf_creation_thread.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });
  vcf_creation_thread.on("close", code => {
    console.log(`child process exited with code ${code}`);
    original_compressed_vcf_file.close();
    call_variants_2();
  });
}
// creates VCF from mpileup VCF
function call_variants_2() {
  console.log("Calling Variants from " + RESULT_VCF_FILE);
  const vcf_edit_thread = spawn("bcftools", ["call", VARIANT_CALLING_FLAGS_2, FILETYPE_FLAG, ORIGINAL_COMPRESSED_VCF_FILE]);
  vcf_edit_thread.stdout.on("data", data => {
    console.log(`stdout: ${data}`);
    result_vcf_file.write(data);
  });
  vcf_edit_thread.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
  });
  vcf_edit_thread.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });
  vcf_edit_thread.on("close", code => {
    console.log(`child process exited with code ${code}`);
    result_vcf_file.close();
    convert_to_JSON();
  });
}
// creates JSON from VCF
function convert_to_JSON() {
  console.log("Calling Variants from " + RESULT_VCF_FILE);
  const vcf_read_thread = fs.readFileSync(RESULT_VCF_FILE,{encoding:"utf-8"});
  
  // display JSON to console
  const json = vcfToJSON(vcf_read_thread).then(response => console.log(response));

  // write JSON to file
  const json_write_thread = vcfToJSON(vcf_read_thread).then(function(results) {
    return new Promise(function(resolve, reject) {
      try {
        fs.writeFileSync(RESULT_JSON_FILE, JSON.stringify(results));

        parameter_sweep();

      } catch (err) {
        console.error(err);
      }
    });
  });
}
// read, parse & display data from JSON file
function parameter_sweep() {
  console.log("Reading JSON from " + RESULT_JSON_FILE);
  const json_read_file = fs.readFile(RESULT_JSON_FILE,{encoding:"utf-8"}, (err, data) => {
    if (err) {
      console.err("Error reading file from " + RESULT_JSON_FILE);
    } else {
      console.log("Performing parameter sweep on variants from JSON");
      
      // parse JSON string to JSON object
      const variants = JSON.parse(data);

      // parameter sweep over Position and Quality
      variants.forEach(variant => {
        console.log("Position: " + variant.pos + ", Quality: " + variant.qual);
      });
    }
    plot_parameters();
  });
}
// plot data from JSON file
function plot_parameters() {
  console.log("Reading JSON from " + RESULT_JSON_FILE);
  const json_read_file = fs.readFile(RESULT_JSON_FILE,{encoding:"utf-8"}, (err, data) => {
    if (err) {
      console.err("Error reading file from " + RESULT_JSON_FILE);
    } else {
      console.log("Performing parameter sweep on variants from JSON");
      
      // parse JSON string to JSON object
      const variants = JSON.parse(data);

      console.log(variants.length);

      var index = 0;
      var x = new Array(variants.length);
      var y = new Array(variants.length);

      // parameter sweep over Position and Quality
      variants.forEach(variant => {
        x[index] = variant.pos;
        y[index] = variant.qual;
        console.log("Position: " + x[index] + ", Quality: " + y[index]);

	index = index + 1;
      });

      // line plot
      plot([{x, y, type: 'line'}]);
 
      // bar plot
      plot([{x, y, type: 'bar'}]);
    }
  });
}
// this section will initiate execution of the pipeline
index_reads();
