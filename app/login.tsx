import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { LogIn, UserPlus, ChevronDown, Key } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { BRAND_COLORS } from '@/constants/colors';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, register, isLoading, isLoggingIn, isRegistering: isRegisteringMutation, getUserByUsername, resetAdminPassword } = useAuth();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [loginType, setLoginType] = useState<'admin' | 'employee'>('employee');
  const [uniqueKey, setUniqueKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion1, setSecurityQuestion1] = useState('');
  const [securityAnswer1, setSecurityAnswer1] = useState('');
  const [securityQuestion2, setSecurityQuestion2] = useState('');
  const [securityAnswer2, setSecurityAnswer2] = useState('');
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [currentQuestionPicker, setCurrentQuestionPicker] = useState<1 | 2>(1);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetAnswer1, setResetAnswer1] = useState('');
  const [resetAnswer2, setResetAnswer2] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState<'username' | 'questions' | 'newPassword'>('username');

  const SECURITY_QUESTIONS = [
    "What was the name of your first pet?",
    "What city were you born in?",
    "What is your mother's maiden name?",
    "What was the name of your elementary school?",
    "What is your favorite movie?",
    "What was the model of your first car?",
    "What is your favorite food?",
    "In what city did you meet your spouse?",
  ];

  WebBrowser.maybeCompleteAuthSession();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    if (loginType === 'employee' && !uniqueKey.trim()) {
      Alert.alert('Error', 'Please enter your unique employee key');
      return;
    }

    try {
      await login({ 
        username: username.trim(), 
        password,
        uniqueKey: loginType === 'employee' ? uniqueKey.trim() : undefined,
        isEmployeeLogin: loginType === 'employee'
      });
      router.replace('/portal-selection');
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'Invalid credentials');
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }
    
    if (!securityQuestion1 || !securityQuestion2) {
      Alert.alert('Error', 'Please select both security questions');
      return;
    }
    
    if (securityQuestion1 === securityQuestion2) {
      Alert.alert('Error', 'Please select different security questions');
      return;
    }
    
    if (!securityAnswer1.trim() || !securityAnswer2.trim()) {
      Alert.alert('Error', 'Please provide answers to both security questions');
      return;
    }

    try {
      await register({ 
        username: username.trim(), 
        password,
        securityQuestion: '',
        securityAnswer: '',
        securityQuestion1, 
        securityAnswer1,
        securityQuestion2,
        securityAnswer2
      });
      Alert.alert('Success', 'Account created! Please log in.', [
        {
          text: 'OK',
          onPress: () => {
            setShowRegisterForm(false);
            setPassword('');
            setConfirmPassword('');
            setSecurityQuestion1('');
            setSecurityAnswer1('');
            setSecurityQuestion2('');
            setSecurityAnswer2('');
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'Could not create account');
    }
  };

  const handleForgotPassword = () => {
    if (loginType === 'employee') {
      Alert.alert(
        'Employee Password Reset',
        'Employees must contact their administrator to reset their password. Admins can reset employee passwords from the Tools page.',
        [{ text: 'OK' }]
      );
    } else {
      setShowResetPassword(true);
      setResetStep('username');
      setResetUsername('');
      setResetAnswer1('');
      setResetAnswer2('');
      setResetNewPassword('');
      setResetConfirmPassword('');
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (resetStep === 'username') {
      if (!resetUsername.trim()) {
        Alert.alert('Error', 'Please enter your username');
        return;
      }
      const user = getUserByUsername(resetUsername.trim());
      if (!user) {
        Alert.alert('Error', 'Username not found');
        return;
      }
      if (user.role !== 'manager') {
        Alert.alert('Error', 'Password reset is only available for admin accounts. Employees must contact their administrator.');
        return;
      }
      setResetStep('questions');
    } else if (resetStep === 'questions') {
      if (!resetAnswer1.trim() || !resetAnswer2.trim()) {
        Alert.alert('Error', 'Please answer both security questions');
        return;
      }
      const user = getUserByUsername(resetUsername.trim());
      if (!user) {
        Alert.alert('Error', 'User not found');
        return;
      }
      if (
        user.securityAnswer1?.toLowerCase().trim() !== resetAnswer1.toLowerCase().trim() ||
        user.securityAnswer2?.toLowerCase().trim() !== resetAnswer2.toLowerCase().trim()
      ) {
        Alert.alert('Error', 'Security answers are incorrect');
        return;
      }
      setResetStep('newPassword');
    } else if (resetStep === 'newPassword') {
      if (!resetNewPassword.trim()) {
        Alert.alert('Error', 'Please enter a new password');
        return;
      }
      if (resetNewPassword.length < 4) {
        Alert.alert('Error', 'Password must be at least 4 characters');
        return;
      }
      if (resetNewPassword !== resetConfirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      try {
        await resetAdminPassword({ username: resetUsername.trim(), newPassword: resetNewPassword });
        Alert.alert('Success', 'Your password has been reset successfully. Please log in with your new password.', [
          {
            text: 'OK',
            onPress: () => {
              setShowResetPassword(false);
              setPassword('');
            },
          },
        ]);
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to reset password');
      }
    }
  };



  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source='https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/3b45n4ikwocbfy3m0gori'
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.title}>Warehouse Manager</Text>
          <Text style={styles.subtitle}>
            {showRegisterForm
              ? 'Create an admin account'
              : loginType === 'admin' 
              ? 'Sign in as Admin'
              : 'Sign in as Employee'}
          </Text>
        </View>

        <View style={styles.form}>
          {!showRegisterForm && (
            <View style={styles.loginTypeSelector}>
              <TouchableOpacity
                style={[styles.loginTypeButton, loginType === 'employee' && styles.loginTypeButtonActive]}
                onPress={() => setLoginType('employee')}
              >
                <Text style={[styles.loginTypeText, loginType === 'employee' && styles.loginTypeTextActive]}>
                  Employee
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loginTypeButton, loginType === 'admin' && styles.loginTypeButtonActive]}
                onPress={() => {
                  setLoginType('admin');
                  setUniqueKey('');
                }}
              >
                <Text style={[styles.loginTypeText, loginType === 'admin' && styles.loginTypeTextActive]}>
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {!showRegisterForm && loginType === 'employee' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Unique Employee Key</Text>
              <View style={styles.keyInputContainer}>
                <Key size={20} color="#6B7280" />
                <TextInput
                  style={styles.keyInput}
                  value={uniqueKey}
                  onChangeText={setUniqueKey}
                  placeholder="Enter your unique key"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.keyHint}>This key was provided by your manager</Text>
            </View>
          )}

          {showRegisterForm && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Security Question 1</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    setCurrentQuestionPicker(1);
                    setShowQuestionPicker(true);
                  }}
                >
                  <Text style={[styles.pickerButtonText, !securityQuestion1 && styles.pickerPlaceholder]}>
                    {securityQuestion1 || 'Select first security question'}
                  </Text>
                  <ChevronDown size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {securityQuestion1 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Answer 1</Text>
                  <TextInput
                    style={styles.input}
                    value={securityAnswer1}
                    onChangeText={setSecurityAnswer1}
                    placeholder="Enter your answer"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Security Question 2</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    setCurrentQuestionPicker(2);
                    setShowQuestionPicker(true);
                  }}
                >
                  <Text style={[styles.pickerButtonText, !securityQuestion2 && styles.pickerPlaceholder]}>
                    {securityQuestion2 || 'Select second security question'}
                  </Text>
                  <ChevronDown size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {securityQuestion2 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Answer 2</Text>
                  <TextInput
                    style={styles.input}
                    value={securityAnswer2}
                    onChangeText={setSecurityAnswer2}
                    placeholder="Enter your answer"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, (isLoggingIn || isRegisteringMutation) && styles.primaryButtonDisabled]}
            onPress={showRegisterForm ? handleRegister : handleLogin}
            disabled={isLoggingIn || isRegisteringMutation}
          >
            {isLoggingIn || isRegisteringMutation ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : showRegisterForm ? (
              <>
                <UserPlus size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Create Account</Text>
              </>
            ) : (
              <>
                <LogIn size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.linkContainer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setShowRegisterForm(!showRegisterForm);
                setPassword('');
                setConfirmPassword('');
                setSecurityQuestion1('');
                setSecurityAnswer1('');
                setSecurityQuestion2('');
                setSecurityAnswer2('');
                setLoginType('admin');
                setUniqueKey('');
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {showRegisterForm
                  ? 'Already have an account? Sign In'
                  : "Admin? Create an account"}
              </Text>
            </TouchableOpacity>

            {!showRegisterForm && (
              <TouchableOpacity
                style={styles.resetPasswordButton}
                onPress={handleForgotPassword}
              >
                <Text style={styles.resetPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>


        </View>
      </ScrollView>
      
      <Modal
        visible={showResetPassword}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResetPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resetPasswordModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowResetPassword(false)}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.resetPasswordContent} keyboardShouldPersistTaps="handled">
              {resetStep === 'username' && (
                <View style={styles.resetPasswordStep}>
                  <Text style={styles.resetPasswordInstruction}>
                    Enter your admin username to begin the password reset process.
                  </Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                      style={styles.input}
                      value={resetUsername}
                      onChangeText={setResetUsername}
                      placeholder="Enter your username"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}
              
              {resetStep === 'questions' && (
                <View style={styles.resetPasswordStep}>
                  <Text style={styles.resetPasswordInstruction}>
                    Answer your security questions to verify your identity.
                  </Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {getUserByUsername(resetUsername)?.securityQuestion1}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={resetAnswer1}
                      onChangeText={setResetAnswer1}
                      placeholder="Enter your answer"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {getUserByUsername(resetUsername)?.securityQuestion2}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={resetAnswer2}
                      onChangeText={setResetAnswer2}
                      placeholder="Enter your answer"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}
              
              {resetStep === 'newPassword' && (
                <View style={styles.resetPasswordStep}>
                  <Text style={styles.resetPasswordInstruction}>
                    Enter your new password.
                  </Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                      style={styles.input}
                      value={resetNewPassword}
                      onChangeText={setResetNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                      style={styles.input}
                      value={resetConfirmPassword}
                      onChangeText={setResetConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              )}
              
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleResetPasswordSubmit}
              >
                <Text style={styles.primaryButtonText}>
                  {resetStep === 'username' ? 'Next' : resetStep === 'questions' ? 'Verify' : 'Reset Password'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <Modal
        visible={showQuestionPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuestionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Security Question</Text>
              <TouchableOpacity onPress={() => setShowQuestionPicker(false)}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {SECURITY_QUESTIONS.map((question) => {
                const isDisabled = currentQuestionPicker === 1 
                  ? question === securityQuestion2 
                  : question === securityQuestion1;
                const isSelected = currentQuestionPicker === 1
                  ? question === securityQuestion1
                  : question === securityQuestion2;
                
                return (
                  <TouchableOpacity
                    key={question}
                    style={[
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                      isDisabled && styles.pickerOptionDisabled,
                    ]}
                    onPress={() => {
                      if (!isDisabled) {
                        if (currentQuestionPicker === 1) {
                          setSecurityQuestion1(question);
                        } else {
                          setSecurityQuestion2(question);
                        }
                        setShowQuestionPicker(false);
                      }
                    }}
                    disabled={isDisabled}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                        isDisabled && styles.pickerOptionTextDisabled,
                      ]}
                    >
                      {question}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  logo: {
    width: 180,
    height: 80,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  linkContainer: {
    gap: 8,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: BRAND_COLORS.primary,
  },
  resetPasswordButton: {
    paddingVertical: 8,
    alignItems: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  resetPasswordText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: BRAND_COLORS.secondary,
  },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  pickerCloseText: {
    fontSize: 24,
    color: '#6B7280',
  },
  pickerOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  pickerOptionTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600' as const,
  },
  pickerOptionDisabled: {
    opacity: 0.4,
  },
  pickerOptionTextDisabled: {
    color: '#9CA3AF',
  },
  resetPasswordModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  resetPasswordContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  resetPasswordStep: {
    gap: 16,
    marginBottom: 20,
  },
  resetPasswordInstruction: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  loginTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  loginTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  loginTypeButtonActive: {
    backgroundColor: BRAND_COLORS.primary,
  },
  loginTypeText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  loginTypeTextActive: {
    color: '#FFFFFF',
  },
  keyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  keyInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  keyHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  securityQuestionDisplay: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  securityQuestionText: {
    fontSize: 16,
    color: '#374151',
    fontStyle: 'italic' as const,
  },
});
