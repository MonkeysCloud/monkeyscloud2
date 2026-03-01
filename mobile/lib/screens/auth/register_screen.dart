import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/auth_provider.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _orgName = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_circle, size: 64, color: AppColors.brand400),
                const SizedBox(height: 12),
                const Text('Create Account', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                const SizedBox(height: 32),

                if (auth.error != null)
                  Container(
                    padding: const EdgeInsets.all(12), margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(color: AppColors.error.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                    child: Text(auth.error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
                  ),

                TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full Name', prefixIcon: Icon(Icons.person_outlined))),
                const SizedBox(height: 16),
                TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined))),
                const SizedBox(height: 16),
                TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock_outlined))),
                const SizedBox(height: 16),
                TextField(controller: _orgName, decoration: const InputDecoration(labelText: 'Organization (optional)', prefixIcon: Icon(Icons.business_outlined))),
                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: auth.isLoading ? null : () => ref.read(authProvider.notifier).register(
                    _name.text, _email.text, _password.text, _orgName.text.isNotEmpty ? _orgName.text : null,
                  ),
                  child: auth.isLoading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Create Account'),
                ),
                const SizedBox(height: 16),
                TextButton(onPressed: () => context.go('/login'), child: const Text('Already have an account? Sign in')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
