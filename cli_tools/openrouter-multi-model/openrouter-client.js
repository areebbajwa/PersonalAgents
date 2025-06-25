import axios from 'axios';

export class OpenRouterClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://openrouter.ai/api/v1/chat/completions';
  }

  async queryModel(model, prompt, options = {}) {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/areebbajwa/PersonalAgents',
      'X-Title': 'OpenRouter Multi-Model CLI'
    };

    const data = {
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 500
    };

    try {
      const response = await axios.post(this.baseURL, data, { headers });
      
      return {
        model: model,
        response: response.data.choices[0]?.message?.content || '',
        usage: response.data.usage || {},
        id: response.data.id || '',
        error: null,
        modelUsed: response.data.model || model, // OpenRouter may use a different model
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        model: model,
        response: '',
        usage: {},
        error: error.response?.data?.error?.message || error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async queryMultipleModels(models, prompt, options = {}) {
    const promises = models.map(model => this.queryModel(model, prompt, options));
    return await Promise.all(promises);
  }
}