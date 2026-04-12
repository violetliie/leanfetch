import { basename, extname } from 'path';

const INCLUDE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.rb', '.php',
  '.vue', '.svelte',
  '.kt', '.scala', '.swift', '.cs',  // Kotlin, Scala, Swift, C#
]);

// Test directory patterns — separated so we can handle them differently
const TEST_PATTERNS = [
  /\/(tests?|spec|__tests__)\//,
  /^(tests?|spec|__tests__)\//,
];

const EXCLUDE_PATTERNS = [
  /^node_modules\//,
  /^\.git\//,
  /^dist\//,
  /^build\//,
  /^coverage\//,
  /^__pycache__\//,
  /^\.next\//,
  /^\.nuxt\//,
  /^vendor\//,
  /^target\//,
  /\/node_modules\//,
  /\/\.git\//,
  /\/dist\//,
  /\/build\//,
  /\/coverage\//,
  /\/__pycache__\//,
  /\/\.next\//,
  /\/\.nuxt\//,
  /\/vendor\//,
  /\/target\//,
  /\.lock$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.js$/,
  /\.map$/,
  /\.d\.ts$/,
  /\.DS_Store$/,
  /\.log$/,
  // Test directories handled separately below — NOT excluded here
];

// Keywords that indicate a test file might make REAL API calls (not just mocks)
const REAL_API_TEST_KEYWORDS = [
  /messages\.create|completions\.create|ChatCompletion/,
  /embeddings\.create|generate_content/,
  /\.invoke\s*\(|\.ainvoke\s*\(/,
  /litellm\.(completion|acompletion)/,
  /api[_-]?key.*=.*os\.|process\.env/i,  // reading real API keys
];

export function structuralFilter(files) {
  return files.filter((file) => {
    const ext = extname(file.path);
    if (!INCLUDE_EXTENSIONS.has(ext)) return false;
    for (const pattern of EXCLUDE_PATTERNS) {
      if (pattern.test(file.path)) return false;
    }
    // Skip very large files (> 500KB likely not hand-written source)
    if (file.size > 500_000) return false;
    return true;
  });
}

// Filter to scope scan to a subdirectory (monorepo support)
export function subpathFilter(files, subpath) {
  if (!subpath) return files;
  const prefix = subpath.replace(/^\/|\/$/g, ''); // normalize
  return files.filter((file) => file.path.startsWith(prefix + '/') || file.path === prefix);
}

const API_KEYWORDS = [
  // LLM SDKs — core
  /anthropic|openai|@anthropic-ai|langchain|llama[-_]?index/i,
  /chat\.completions|messages\.create|ChatCompletion/,
  // Embeddings & vector
  /embeddings\.create|embed\(|embedding_function/,
  /fine.?tun|training.?job|create_fine_tuning/i,
  /audio\.transcriptions|speech\.create|whisper/i,
  /images\.(generate|edit|variations)/,
  // Vercel AI SDK
  /generateText|streamText|generateObject|streamObject|@ai-sdk/i,
  // AWS Bedrock
  /bedrock-runtime|InvokeModelCommand|ConverseCommand|invoke_model|converse\s*\(/i,
  // Azure OpenAI
  /AzureOpenAI|azure_endpoint|openai\.azure\.com/i,
  // Cohere
  /cohere\.Client|cohere\.ClientV2|co\.(chat|embed|rerank|classify)\s*\(/i,
  // Together AI
  /together-ai|from together import|Together\(\)/i,
  // Fireworks AI
  /fireworks-ai|api\.fireworks\.ai|from fireworks/i,
  // Perplexity
  /api\.perplexity\.ai|sonar/i,
  // AI21
  /ai21|AI21Client|jamba/i,
  // Agent frameworks
  /autogen|autogen_agentchat|ConversableAgent|UserProxyAgent/i,
  /crewai|CrewBase|Crew\(\)|\.kickoff\s*\(/i,
  /semantic.kernel|kernel\.invoke|kernel\.add_service/i,
  /haystack|Pipeline\(\).*add_component|OpenAIChatGenerator/i,
  // Ollama
  /ollama\.(chat|generate)\s*\(/,
  // Self-hosted / local inference
  /localhost.*(v1|completions|chat)|127\.0\.0\.1.*(v1|completions)/,
  // HTTP clients
  /fetch\s*\(|axios\.|requests\.(get|post|put|delete|patch)|http\.(Get|Post)/,
  /\.get\s*\(|\.post\s*\(|\.put\s*\(|\.delete\s*\(/,
  // API patterns
  /api[_-]?key|bearer|authorization/i,
  /rate.?limit|retry|backoff|exponential/i,
  // Streaming
  /stream.*true|stream.*response|SSE|EventSource/i,
  // Token / model references
  /max_tokens|model\s*[:=]\s*["']/,
  /gpt-|claude-|gemini-|llama|command-r|sonar|jamba|mistral/i,
  // Go / Java / C# / Rust LLM SDKs
  /anthropic-sdk-go|sashabaranov\/go-openai/,
  /AnthropicClient|OpenAiService|azure\.ai\.openai/i,
  /async_openai|anthropic::Client/,
  // Kotlin / Swift / Scala
  /langchain4j|AiServices\.create|dev\.langchain4j/i,
  /SwiftOpenAI|MacPaw.*OpenAI/i,
  /openai-scala|sttp\.ai|llm4s/i,
];

export function keywordFilter(files) {
  return files.filter((file) => {
    if (!file.content) return false;

    const isTestFile = TEST_PATTERNS.some((p) => p.test(file.path));

    if (isTestFile) {
      // Test files only pass if they contain real API call patterns (not just mocks)
      return REAL_API_TEST_KEYWORDS.some((re) => re.test(file.content));
    }

    return API_KEYWORDS.some((re) => re.test(file.content));
  });
}
