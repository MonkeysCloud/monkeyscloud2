import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const brand50  = Color(0xFFF0F4FF);
  static const brand100 = Color(0xFFD9E4FF);
  static const brand200 = Color(0xFFB3C9FF);
  static const brand300 = Color(0xFF809FFF);
  static const brand400 = Color(0xFF6B8AFF);
  static const brand500 = Color(0xFF4F6BED);
  static const brand600 = Color(0xFF3A51CC);
  static const brand700 = Color(0xFF2D3FA6);
  static const brand800 = Color(0xFF1E2D7A);
  static const brand900 = Color(0xFF111B4E);

  static const surface50  = Color(0xFFF8FAFC);
  static const surface100 = Color(0xFFF1F5F9);
  static const surface200 = Color(0xFFE2E8F0);
  static const surface300 = Color(0xFFCBD5E1);
  static const surface400 = Color(0xFF94A3B8);
  static const surface500 = Color(0xFF64748B);
  static const surface600 = Color(0xFF475569);
  static const surface700 = Color(0xFF334155);
  static const surface800 = Color(0xFF1E293B);
  static const surface850 = Color(0xFF172033);
  static const surface900 = Color(0xFF0F172A);
  static const surface950 = Color(0xFF0A0F1E);

  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const error   = Color(0xFFEF4444);
  static const info    = Color(0xFF3B82F6);
}

class AppTheme {
  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.surface950,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.brand500,
      secondary: AppColors.brand400,
      surface: AppColors.surface900,
      error: AppColors.error,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      onSurface: AppColors.surface100,
      onError: Colors.white,
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface900,
      foregroundColor: AppColors.surface100,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardTheme(
      color: AppColors.surface900,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.surface800, width: 1),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface900,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.surface700),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.surface700),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.brand500, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brand600,
        foregroundColor: Colors.white,
        minimumSize: const Size(double.infinity, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.surface900,
      selectedItemColor: AppColors.brand400,
      unselectedItemColor: AppColors.surface500,
      type: BottomNavigationBarType.fixed,
    ),
    dividerColor: AppColors.surface800,
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.surface800,
      labelStyle: const TextStyle(color: AppColors.surface200, fontSize: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      side: BorderSide.none,
    ),
  );
}
