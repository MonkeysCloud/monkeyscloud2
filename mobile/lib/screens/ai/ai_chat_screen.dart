import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/api_client.dart';
import 'package:monkeyscloud/core/theme.dart';

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key});
  @override ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _controller = TextEditingController();
  final _messages = <_ChatMessage>[];
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(children: [
          Icon(Icons.auto_awesome, color: AppColors.brand400, size: 20),
          SizedBox(width: 8),
          Text('MonkeysAI'),
        ]),
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.auto_awesome, size: 48, color: AppColors.brand400.withOpacity(0.5)),
                    const SizedBox(height: 12),
                    const Text('Ask MonkeysAI anything', style: TextStyle(color: AppColors.surface400, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text('Code review, build analysis, deploy risk...', style: TextStyle(color: AppColors.surface500, fontSize: 13)),
                  ]))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    reverse: true,
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final msg = _messages[_messages.length - 1 - i];
                      return Align(
                        alignment: msg.isUser ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                          decoration: BoxDecoration(
                            color: msg.isUser ? AppColors.brand600 : AppColors.surface800,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(msg.text, style: const TextStyle(fontSize: 14, height: 1.4)),
                        ),
                      );
                    },
                  ),
          ),

          // Input bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              color: AppColors.surface900,
              border: Border(top: BorderSide(color: AppColors.surface800)),
            ),
            child: SafeArea(
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    maxLines: 3,
                    minLines: 1,
                    decoration: const InputDecoration(
                      hintText: 'Ask MonkeysAI...', border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                  ),
                ),
                IconButton(
                  icon: _loading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send, color: AppColors.brand400),
                  onPressed: _loading ? null : _send,
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    _controller.clear();

    setState(() {
      _messages.add(_ChatMessage(text: text, isUser: true));
      _loading = true;
    });

    try {
      // TODO: Call AI endpoint
      await Future.delayed(const Duration(seconds: 1));
      setState(() => _messages.add(_ChatMessage(text: 'AI response placeholder...', isUser: false)));
    } catch (e) {
      setState(() => _messages.add(_ChatMessage(text: 'Error: $e', isUser: false)));
    } finally {
      setState(() => _loading = false);
    }
  }
}

class _ChatMessage {
  final String text;
  final bool isUser;
  _ChatMessage({required this.text, required this.isUser});
}
