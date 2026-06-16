// 서버/클라이언트 공통 설정 값 (클라이언트의 constants.ts 와 동일하게 유지)

export const TEAM_CONFIG = [
  { id: 0, name: 'TEAM 1', color: 'bg-team-1', hex: '#4D77FF', textColor: 'text-white' },
  { id: 1, name: 'TEAM 2', color: 'bg-team-2', hex: '#A066FF', textColor: 'text-white' },
  { id: 2, name: 'TEAM 3', color: 'bg-team-3', hex: '#FFD700', textColor: 'text-black' },
  { id: 3, name: 'TEAM 4', color: 'bg-team-4', hex: '#00E676', textColor: 'text-black' },
  { id: 4, name: 'TEAM 5', color: 'bg-team-5', hex: '#FF1744', textColor: 'text-white' },
  { id: 5, name: 'TEAM 6', color: 'bg-team-6', hex: '#00E5FF', textColor: 'text-black' },
  { id: 6, name: 'TEAM 7', color: 'bg-team-7', hex: '#FF9100', textColor: 'text-black' },
  { id: 7, name: 'TEAM 8', color: 'bg-team-8', hex: '#F50057', textColor: 'text-white' },
  { id: 8, name: 'TEAM 9', color: 'bg-team-9', hex: '#C6FF00', textColor: 'text-black' },
];

export const MINI_GAMES = [
  { id: 1, title: '가위 바위 보', description: '단판 승부! 비기면 다시!' },
  { id: 2, title: '묵 찌 빠', description: '가위바위보 승자가 공격권을 가짐' },
  { id: 3, title: '병뚜껑 멀리 보내기', description: '책상 끝에 가장 가깝게 보낸 팀 승리' },
  { id: 4, title: '엄지 씨름', description: '손을 맞잡고 엄지를 먼저 누르면 승리' },
  { id: 5, title: '눈싸움', description: '먼저 눈을 깜빡이면 패배' },
  { id: 6, title: '참 참 참', description: '고개를 공격 방향과 같게 돌리면 패배' },
  { id: 7, title: '책 펼치기', description: '책을 펼쳐 사람이 더 많이 나오면 승리' },
  { id: 8, title: '동전 던지기', description: '동전을 던져 앞/뒤 맞추기' },
  { id: 9, title: '탕수육 게임', description: '탕-수-육 단어 이어 말하기 (박자 놓치면 패배)' },
  { id: 10, title: '제로 게임', description: '엄지 손가락 갯수 맞추기' },
];

// 빌트인 카테고리 메타 (관리자가 추가한 커스텀 카테고리는 문제 데이터로부터 동적 인식)
export const BUILTIN_CATEGORIES = [
  { id: 'HRD', label: 'HRD / 교육', desc: '기업 교육 이론 및 트렌드' },
  { id: 'ETIQUETTE', label: '직장 예절', desc: '비즈니스 매너와 커뮤니케이션' },
  { id: 'LEADERSHIP', label: '리더십', desc: '조직 관리와 리더의 역량' },
  { id: 'SECURITY', label: '정보 보안', desc: '보안 수칙 및 IT 상식' },
];

export const winThresholdFor = (size) => (size === 4 ? 2 : size === 5 ? 3 : 4);
