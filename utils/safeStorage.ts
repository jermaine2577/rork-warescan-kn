import AsyncStorage from '@react-native-async-storage/async-storage';

export async function safeGetItem(key: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    
    if (!value || !value.trim()) {
      return null;
    }
    
    const trimmed = value.trim();
    
    if (trimmed.includes('[object') || trimmed.includes('object Object') ||
        trimmed === 'object' || trimmed === 'undefined' || trimmed === 'null') {
      console.error(`Corrupted data detected in ${key}, clearing...`);
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    const firstChar = trimmed[0];
    if (firstChar !== '[' && firstChar !== '{' && firstChar !== '"' && !key.includes('user_id')) {
      console.error(`Invalid JSON in ${key}, clearing...`);
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    if (!key.includes('user_id')) {
      try {
        JSON.parse(trimmed);
      } catch (e) {
        console.error(`JSON parse failed for ${key}, clearing...`);
        await AsyncStorage.removeItem(key);
        return null;
      }
    }
    
    return trimmed;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return null;
  }
}

export async function safeSetItem(key: string, value: string): Promise<boolean> {
  try {
    if (typeof value !== 'string') {
      console.error(`Attempted to store non-string value for ${key}:`, typeof value);
      return false;
    }
    
    if (value.includes('[object') || value.includes('object Object')) {
      console.error(`Attempted to store corrupted data for ${key}`);
      return false;
    }
    
    if (!key.includes('user_id')) {
      try {
        JSON.parse(value);
      } catch (e) {
        console.error(`Attempted to store invalid JSON for ${key}`);
        return false;
      }
    }
    
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
    return false;
  }
}

export async function safeRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
  }
}
