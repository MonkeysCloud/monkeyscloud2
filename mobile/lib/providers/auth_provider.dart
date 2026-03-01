import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/auth_service.dart';
import 'package:monkeyscloud/models/user.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authServiceProvider));
});

class AuthState {
  final User? user;
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;
  final Organization? currentOrg;
  final List<Organization> organizations;

  AuthState({
    this.user,
    this.isAuthenticated = false,
    this.isLoading = false,
    this.error,
    this.currentOrg,
    this.organizations = const [],
  });

  AuthState copyWith({
    User? user, bool? isAuthenticated, bool? isLoading,
    String? error, Organization? currentOrg, List<Organization>? organizations,
  }) => AuthState(
    user: user ?? this.user,
    isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    isLoading: isLoading ?? this.isLoading,
    error: error,
    currentOrg: currentOrg ?? this.currentOrg,
    organizations: organizations ?? this.organizations,
  );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _service;

  AuthNotifier(this._service) : super(AuthState()) {
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    if (await _service.isAuthenticated()) {
      state = state.copyWith(isLoading: true);
      try {
        final user = await _service.me();
        state = state.copyWith(user: user, isAuthenticated: true, isLoading: false);
      } catch (_) {
        state = state.copyWith(isLoading: false);
      }
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _service.login(email, password);
      state = state.copyWith(user: result.user, isAuthenticated: true, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> register(String name, String email, String password, String? orgName) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _service.register(name: name, email: email, password: password, organizationName: orgName);
      state = state.copyWith(user: result.user, isAuthenticated: true, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> logout() async {
    await _service.logout();
    state = AuthState();
  }

  void setOrganization(Organization org) {
    state = state.copyWith(currentOrg: org);
  }
}
