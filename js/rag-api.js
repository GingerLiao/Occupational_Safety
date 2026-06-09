/* ============================================================
   rag-api.js — Gemini Data RAG 對話 API 客戶端
   依官方範例串接，支援串流(streaming)。
   若瀏覽器 CORS 或網路受限，會自動退回本地知識庫推理(fallback)，
   確保 Demo 任何情境下都能運作。
   ============================================================ */
const RAG = {
  API_BASE_URL: "https://cloud.geminidata.com/api/portal/api10",
  PROJECT_ID:  "69eafcffe2d327002b0c6399",
  PROJECT_TOKEN:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMjY4YWZlMzcxNjRhMDAyYjhiMjdmNCIsImlzQVBJIjp0cnVlLCJnX3VpZCI6IjY5ZWI5MjUwZTJkMzI3MDAyYjBjYmVhOSIsImdfYWRtaW4iOmZhbHNlLCJnX2RlbW9hZG1pbiI6ZmFsc2UsImdfYWNjb3VudGFkbWluIjpmYWxzZSwiZ190aWQiOiI2OWVhZmNmZmUyZDMyNzAwMmIwYzYzOTk6cHJvZHVjZXIiLCJnX3RpZF9wZXJtaXNzaW9uIjpbIm1ldGE6dXBkYXRlIiwic291cmNlOnJlYWQiLCJzb3VyY2U6dXBkYXRlIiwic291cmNlOmRlbGV0ZSIsImdyYXBoOnJlYWQiLCJncmFwaDp1cGRhdGUiLCJncmFwaDpkZWxldGUiLCJncmFwaDpleHBsb3JlIiwiZ3JhcGg6ZXhwb3J0IiwiY2FudmFzOmFubm90YXRlIiwiY2FudmFzOnBlcnNvbmFsaXplIiwiZGFzaGJvYXJkOnJlYWQiLCJkYXNoYm9hcmQ6dXBkYXRlIiwiY2FudmFzOnNoYXBlIl0sImdfdGlkX3BhcnNlcl9zb3VyY2UiOiJjc3YiLCJnX3RpZF9mZWF0dXJlX2FkZF9vbnMiOlsiYXNzaXN0YW50Il0sImdfYXZhdGFyIjoiMDIiLCJpc3MiOiJodHRwczovL2Nsb3VkLmdlbWluaWRhdGEuY29tIiwic3ViIjoiNjllYjkyNTBlMmQzMjcwMDJiMGNiZWE5IiwiYXVkIjoiaHR0cHM6Ly9jbG91ZC5nZW1pbmlkYXRhLmNvbSIsImV4cCI6NDg2NjcwNTI4MiwiaWF0IjoxNzgwOTEwODQ3LCJuaWNrbmFtZSI6Im1lbWJlcjg1QHdvcmtzaG9wLmNvbSIsImVtYWlsIjoibWVtYmVyODVAd29ya3Nob3AuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlfQ.05x7dZIMwt5YaFmv5DM_lzYTNxL8hebEp4y-Lm5hy_s",
  chatId: null,

  headers(){
    return {
      "Authorization": `Bearer ${this.PROJECT_TOKEN}`,
      "x-application-tenant": this.PROJECT_ID,
      "Content-Type": "application/json",
    };
  },

  async ensureChat(){
    if(this.chatId) return this.chatId;
    // 嘗試取得既有對話，否則建立新對話
    const res = await fetch(`${this.API_BASE_URL}/assistant/chat/list`, {headers:this.headers()});
    if(res.ok){
      const data = await res.json();
      const list = data.data || [];
      if(list.length){ this.chatId = list[list.length-1]._id; return this.chatId; }
    }
    const nc = await fetch(`${this.API_BASE_URL}/assistant/chat/create`, {method:"POST",headers:this.headers(),body:"{}"});
    const ncd = await nc.json();
    this.chatId = ncd?.data?.insertedId;
    return this.chatId;
  },

  /**
   * 送出問題，串流回傳。onChunk(partialText) 每次更新；回傳最終文字。
   * @returns {Promise<{text:string, live:boolean}>}
   */
  async ask(question, onChunk){
    try{
      const chatId = await this.ensureChat();
      if(!chatId) throw new Error("no chat id");
      const resp = await fetch(`${this.API_BASE_URL}/assistant/chat/${chatId}`, {
        method:"POST", headers:this.headers(),
        body: JSON.stringify({q: question, streaming:true}),
      });
      if(!resp.ok || !resp.body) throw new Error("bad response "+resp.status);
      const reader = resp.body.getReader();
      const dec = new TextDecoder("utf-8");
      let buf="", final="";
      while(true){
        const {done,value} = await reader.read();
        if(done) break;
        buf += dec.decode(value,{stream:true});
        const lines = buf.split("\n");
        buf = lines.pop();
        for(const line of lines){
          const s=line.trim();
          if(s.startsWith("data:")){
            const js=s.slice(5).trim();
            if(!js) continue;
            try{ const p=JSON.parse(js); if(p.result!=null){ final=p.result; onChunk && onChunk(final); } }catch(e){}
          }
        }
      }
      if(!final) throw new Error("empty result");
      return {text:final, live:true};
    }catch(err){
      // 退回本地知識庫推理
      const text = await LocalRAG.answer(question);
      // 模擬串流體驗
      if(onChunk){
        let acc="";
        const tokens = text.split(/(?<=[\s，。、；！？\n])/);
        for(const tk of tokens){ acc+=tk; onChunk(acc); await new Promise(r=>setTimeout(r,12)); }
      }
      return {text, live:false};
    }
  },
};
window.RAG = RAG;
