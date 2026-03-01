import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/api_client.dart';
import 'package:monkeyscloud/models/user.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(ref.read(apiClientProvider));
});

class AuthService {
  final ApiClient _api;

  AuthService(this._api);

  Future<AuthResult> login(String email, String password) async {
    final res = await _api.post('/api/v1/auth/login', data: {
      'email': email,
      'password': password,
    });
    final token = res.data['token'] as String;
    await _api.setToken(token);
    return AuthResult(
      token: token,
      user: User.fromJson(res.data['user']),
    );
  }

  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
    String? organizationName,
  }) async {
    final res = await _api.post('/api/v1/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
      if (organizationName != null) 'organization_name': organizationName,
    });
    final token = res.data['token'] as String;
    await _api.setToken(token);
    return AuthResult(
      token: token,
      user: User.fromJson(res.data['user']),
    );
  }

  Future<User> me() async {
    final res = await _api.get('/api/v1/auth/me');
    return User.fromJson(res.data);
  }

  Future<void> logout() async {
    try { await _api.post('/api/v1/auth/logout'); } catch (_) {}
    await _api.clearToken();
  }

  Future<bool> isAuthenticated() async {
    final token = await _api.getToken();
    return token != null;
  }
}

class AuthResult {
  final String token;
  final User user;
  AuthResult({required this.token, required this.user});
}
