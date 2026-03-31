import { Injectable, NotFoundException } from '@nestjs/common';

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: 'female' | 'male';
  description: string;
  provider: 'cartesia' | 'elevenlabs';
  preview_available: boolean;
}

const VOICES: Voice[] = [
  {
    id: 'sv-female-professional',
    name: 'Swedish Female — Professional',
    language: 'sv-SE',
    gender: 'female',
    description: 'Professional, warm female voice in Swedish',
    provider: 'cartesia',
    preview_available: false,
  },
  {
    id: 'sv-male-professional',
    name: 'Swedish Male — Professional',
    language: 'sv-SE',
    gender: 'male',
    description: 'Professional, authoritative male voice in Swedish',
    provider: 'cartesia',
    preview_available: false,
  },
  {
    id: 'en-female-professional',
    name: 'English Female — Professional',
    language: 'en-US',
    gender: 'female',
    description: 'Professional, warm female voice in English',
    provider: 'cartesia',
    preview_available: false,
  },
  {
    id: 'en-male-professional',
    name: 'English Male — Professional',
    language: 'en-US',
    gender: 'male',
    description: 'Professional, authoritative male voice in English',
    provider: 'cartesia',
    preview_available: false,
  },
];

@Injectable()
export class AiService {
  listVoices(): { data: Voice[] } {
    return { data: VOICES };
  }

  getVoicePreview(id: string): { voice_id: string; preview_url: string | null; message: string } {
    const voice = VOICES.find((v) => v.id === id);
    if (!voice) throw new NotFoundException('Voice not found');

    // TODO: Generate real preview audio via Cartesia/ElevenLabs API
    return {
      voice_id: id,
      preview_url: null,
      message: 'Voice preview not available — Cartesia/ElevenLabs integration pending',
    };
  }

  validateScript(script: string): {
    valid: boolean;
    variables: string[];
    estimated_tokens: number;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for unclosed braces
    const unclosedOpen = (script.match(/\{[^}]*$/gm) ?? []).length;
    const unclosedClose = (script.match(/^[^{]*\}/gm) ?? []).length;
    if (unclosedOpen > 0) errors.push('Script contains unclosed "{" brace(s)');
    if (unclosedClose > 0) errors.push('Script contains unmatched "}" brace(s)');

    // Extract all {variable} placeholders
    const matches = script.match(/\{([^{}]+)\}/g) ?? [];
    const variables = [...new Set(matches.map((m) => m.slice(1, -1).trim()))];

    // Validate variable names (alphanumeric + underscore only)
    for (const variable of variables) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) {
        errors.push(`Invalid variable name: "{${variable}}" — use letters, digits and underscores only`);
      }
    }

    // Rough token estimate: ~4 chars per token
    const estimated_tokens = Math.ceil(script.length / 4);

    if (estimated_tokens > 8000) {
      errors.push(
        `Script is very long (~${estimated_tokens} tokens). Maximum context is 8,000 tokens — earlier turns will be summarized during long calls.`,
      );
    }

    return {
      valid: errors.length === 0,
      variables,
      estimated_tokens,
      errors,
    };
  }
}
