use Calculator;

my $result = add(2, 4);
my $multiline = "The quick brown fox jumped over\nthe lazy dog.";
my $escaped = "isn't";

my @numberArray = qw/1 2 3/;
my @stringArray = qw/one two three/;

my %hash = (
  "a" => "b",
  0 => 127
);

my $anonHash = {
  1 => 255
};

my @emptyArray = ();
my $emptyArrayRef = [];

my %emptyHash = ();
my $emptyHashRef = {};

my $anonArray = [
  "a", "b", "c"
];

my %all = (
  "scalar" => "Hello World",
  "arr" => \@emptyArray,
  "hash" => \%hash,
  "code" => \&Calculator::add,
  "anon" => $anonHash
);

my @refArr = ();
push @refArr, {
  "foo" => \%hash,
};
push @refArr, {
  "bar" => $anonHash
};

print "2 + 4 = $result\n";
